
const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://asterisk-ext/asteriskext.js");


/******************************************************************************/
/* AsteriskExtChrome Namespace                                                */
/******************************************************************************/

if ("undefined" == typeof(AsteriskExtChrome)) {
	var AsteriskExtChrome = {

/******************************************************************************/
/* Global Vars                                                                */
/******************************************************************************/

	ps: Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch),


/******************************************************************************/
/* Browser Functions                                                          */
/******************************************************************************/

		history: {
			load: function() {
				var limit = AsteriskExtChrome.ps.getIntPref("extensions.asterisk.history-limit");
				AsteriskExtChrome.stringBundle = document.getElementById('asterisk-ext-strings');
				document.getElementById("queryLimit").textContent = limit;
				document.getElementById("history").builder.rebuild();
			},

			onContextMenu: function(event)
			{
				var history = document.getElementById("history");
				var item = history.getSelectedItem(0);
				
				var number = AsteriskExt.cleanPhoneNumber(item.value);
				if( number.length > 0 )
				{
					document.getElementById("context-asterisk").label =
						AsteriskExtChrome.stringBundle.getString("menu_call")+" "+number;
					document.getElementById("context-asterisk").value = number;
					document.getElementById("context-asterisk-edit").label =
						AsteriskExtChrome.stringBundle.getString("menu_editcall")+" "+number;
					document.getElementById("context-asterisk-edit").value = number;
				}
				else
				{
					return false;
				}
					
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
				var result = prompts.confirm(window, "Asterisk Click2Dial",
					AsteriskExtChrome.stringBundle.getString("menu_call")+" "+number+" ?");
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
				result = prompts.prompt(window, "Asterisk Click2Dial",
					AsteriskExtChrome.stringBundle.getString("menu_call")+" ", input, null, check);
				if( result )
				{
					AsteriskExt.dial(input.value);
				}
			},


		},

	}
}

