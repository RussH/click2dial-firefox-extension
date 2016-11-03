Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Ci = Components.interfaces;
const Cc = Components.classes;

const CLASS_ID = Components.ID("cea1c70c-59a5-46c3-abac-75745f75d175");
const CLASS_NAME = "PhoneNumber AutoComplete";
const CONTRACT_ID = "@mozilla.org/autocomplete/search;1?name=phonenumber-autocomplete";

// Implements nsIAutoCompleteResult
function PhoneNumberAutoCompleteResult(searchString, searchResult,
                                  defaultIndex, errorDescription,
                                  results, comments) {
  this._searchString = searchString;
  this._searchResult = searchResult;
  this._defaultIndex = defaultIndex;
  this._errorDescription = errorDescription;
  this._results = results;
  this._comments = comments;
}

PhoneNumberAutoCompleteResult.prototype = {
  _searchString: "",
  _searchResult: 0,
  _defaultIndex: 0,
  _errorDescription: "",
  _results: [],
  _comments: [],

  /**
   * The original search string
   */
  get searchString() {
    return this._searchString;
  },

  /**
   * The result code of this result object, either:
   *         RESULT_IGNORED   (invalid searchString)
   *         RESULT_FAILURE   (failure)
   *         RESULT_NOMATCH   (no matches found)
   *         RESULT_SUCCESS   (matches found)
   */
  get searchResult() {
    return this._searchResult;
  },

  /**
   * Index of the default item that should be entered if none is selected
   */
  get defaultIndex() {
    return this._defaultIndex;
  },

  /**
   * A string describing the cause of a search failure
   */
  get errorDescription() {
    return this._errorDescription;
  },

  /**
   * The number of matches
   */
  get matchCount() {
    return this._results.length;
  },

  /**
   * Get the label of the result at the given index
   */
  getLabelAt: function(index) {
    return this._results[index]+" "+this._comments[index];
  },
  
  /**
   * Get the value of the result at the given index
   */
  getValueAt: function(index) {
    return this._results[index];
  },

  /**
   * Get the comment of the result at the given index
   */
  getCommentAt: function(index) {
    return this._comments[index];
  },

  /**
   * Get the style hint for the result at the given index
   */
  getStyleAt: function(index) {
    if (!this._comments[index])
      return null;  // not a category label, so no special styling

    if (index == 0)
      return "suggestfirst";  // category label on first line of results

    return "suggesthint";   // category label on any other line of results
  },

  /**
   * Get the image for the result at the given index
   * The return value is expected to be an URI to the image to display
   */
  getImageAt : function (index) {
    return "";
  },

  /**
   * Remove the value at the given index from the autocomplete results.
   * If removeFromDb is set to true, the value should be removed from
   * persistent storage as well.
   */
  removeValueAt: function(index, removeFromDb) {
    this._results.splice(index, 1);
    this._comments.splice(index, 1);
  },

  QueryInterface: function(aIID) {
    if (!aIID.equals(Ci.nsIAutoCompleteResult) && !aIID.equals(Ci.nsISupports))
        throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};


// Implements nsIAutoCompleteSearch
function PhoneNumberAutoCompleteSearch() {
}

PhoneNumberAutoCompleteSearch.prototype = {

	classID: CLASS_ID,
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIPhoneNumberAutoCompleteSearch]),

	conn : null,

	cs: Cc["@mozilla.org/consoleservice;1"].
   	getService(Ci.nsIConsoleService),

	open: function() {
		if( this.conn != null ) return 1;
		this.cs.logStringMessage("Component Open DB connection");
		var file = Cc["@mozilla.org/file/directory_service;1"]  
			.getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
		file.append("asterisk-ext.sqlite");
		this.conn = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService).openDatabase(file)
		this.createTables();
	},

	createTables: function() {
		if( this.conn == null ) return 0;
		if( !this.conn.tableExists('history') )
		{
			this.conn.executeSimpleSQL('CREATE TABLE IF NOT EXISTS "main"."history" \
					("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , \
					"number" VARCHAR, \
					"name" VARCHAR, \
					"direction" VARCHAR, \
					"ringtime" INTEGER, \
					"answertime" INTEGER, \
					"hanguptime" INTEGER)');
			this.conn.executeSimpleSQL('CREATE INDEX "main"."call_date_desc" ON "history" ("ringtime" DESC)');
		}
	},

	close: function() {
		this.conn.asyncClose();
		this.conn = null;
	},

  /*
   * Search for a given string and notify a listener (either synchronously
   * or asynchronously) of the result
   *
   * @param searchString - The string to search for
   * @param searchParam - An extra parameter
   * @param previousResult - A previous result to use for faster searching
   * @param listener - A listener to notify when the search is complete
   */
  startSearch: function(searchString, searchParam, result, listener) {
  	this.open();

		var stmt = this.conn.createStatement("SELECT number, name FROM history WHERE (number LIKE ?1) OR (name LIKE ?2) GROUP BY number");
		stmt.bindStringParameter(0, searchString+"%");
		stmt.bindStringParameter(1, "%"+searchString+"%");

		this.cs.logStringMessage("search string: "+searchString);

		stmt.executeAsync({
			autocomplete: this,
			listener: listener,
			cs: Cc["@mozilla.org/consoleservice;1"].
		   	getService(Ci.nsIConsoleService),

			handleResult: function(aResultSet) {
			  var results = [];
			  var comments = [];
				for (let row = aResultSet.getNextRow();
					row;
					row = aResultSet.getNextRow())
				{
					let number = row.getResultByName("number");
					let cidname = row.getResultByName("name");
					results.push(number);
					comments.push(cidname);
				}
	      var newResult = new PhoneNumberAutoCompleteResult(
	      	searchString, Ci.nsIAutoCompleteResult.RESULT_SUCCESS, 0, "", results, comments);
				this.listener.onSearchResult(this.autocomplete, newResult);
			},

			handleError: function(aError) {
				this.cs.logStringMessage("Error: " + aError.message);
			},

			handleCompletion: function(aReason) {
				if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
					this.cs.logStringMessage(3, "Query canceled or aborted!");
				}
			}
		});
  },

  /*
   * Stop an asynchronous search that is in progress
   */
  stopSearch: function() {
  },
    
  QueryInterface: function(aIID) {
    if (!aIID.equals(Ci.nsIAutoCompleteSearch) && !aIID.equals(Ci.nsISupports))
        throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

// Factory
var PhoneNumberAutoCompleteSearchFactory = {
  singleton: null,
  createInstance: function (aOuter, aIID) {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    if (this.singleton == null)
      this.singleton = new PhoneNumberAutoCompleteSearch();
    return this.singleton.QueryInterface(aIID);
  }
};

// Module
var PhoneNumberAutoCompleteSearchModule = {
  registerSelf: function(aCompMgr, aFileSpec, aLocation, aType) {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(CLASS_ID, CLASS_NAME, CONTRACT_ID, aFileSpec, aLocation, aType);
  },

  unregisterSelf: function(aCompMgr, aLocation, aType) {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(CLASS_ID, aLocation);        
  },
  
  getClassObject: function(aCompMgr, aCID, aIID) {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (aCID.equals(CLASS_ID))
      return PhoneNumberAutoCompleteSearchFactory;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function(aCompMgr) { return true; }
};

// Module initialization
/*
function NSGetModule(aCompMgr, aFileSpec) { return PhoneNumberAutoCompleteSearchModule; }

function NSGetFactory(cid) {
  if (cid.toString().toUpperCase() != CLASS_ID.toString().toUpperCase()) {
    throw Components.results.NS_ERROR_FACTORY_NOT_REGISTERED;
  }

  return PhoneNumberAutoCompleteSearch;
}
*/

const NSGetFactory = XPCOMUtils.generateNSGetFactory([PhoneNumberAutoCompleteSearch]);


