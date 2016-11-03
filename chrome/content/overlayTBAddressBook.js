
var Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils;

Cu.import("resource://asterisk-ext/asteriskext.js");

/******************************************************************************/
/* AsteriskExtChrome Namespace                                                */
/******************************************************************************/

if ("undefined" == typeof(AsteriskExtChrome)) {
	var AsteriskExtChrome = {

/******************************************************************************/
/* Global Vars                                                                */
/******************************************************************************/

		prefsListener: null,

		ps: Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch),
		
/******************************************************************************/
/* Browser Functions                                                          */
/******************************************************************************/

		BrowserOverlay: {

			// entry point
			load: function (event) {
				AsteriskExtChrome.stringBundle = document.getElementById('asterisk-ext-strings');
				AsteriskExt.logmessage(2, "AddressBook LOAD");
			},

			dial: function(number)
			{
				AsteriskExt.dial(number);
			},

			confirmDial: function(number)
			{
				if( number.length == 0 ) return;
				var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
				var result = prompts.confirm(window, "Asterisk Click2Dial", AsteriskExtChrome.stringBundle.getString("menu_call")+" "+number+" ?");
				if( result )
				{
					AsteriskExt.dial(number);
				}
			},

			editConfirmDial: function(number)
			{
				if( number.length == 0 ) return;
				var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
				var input = {value: number};
				var check = {value: false};
				result = prompts.prompt(window, "Asterisk Click2Dial", AsteriskExtChrome.stringBundle.getString("menu_call")+" ", input, null, check);
				if( result )
				{
					AsteriskExt.dial(input.value);
				}
			},
		}
	}
}

//if( window.getBrowser ) window.getBrowser().addEventListener("load", AsteriskExtChrome.BrowserOverlay.load, true);
window.addEventListener("load", AsteriskExtChrome.BrowserOverlay.load, true);

