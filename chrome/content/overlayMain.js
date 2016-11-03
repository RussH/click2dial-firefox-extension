
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
				AsteriskExt.logmessage(2, "BROWSER LOAD");
				AsteriskExt.updatePrefs();

				document.getElementById("asterisk-ext-status-icon").setAttribute("hidden", 
					!AsteriskExtChrome.ps.getBoolPref("extensions.asterisk.statusicon") );
				document.getElementById("asterisk-ext-status-textbox").setAttribute("hidden", 
					!AsteriskExtChrome.ps.getBoolPref("extensions.asterisk.statustextbox") );

				AsteriskExt.Storage.open();

				AsteriskExtChrome.prefsListener = new AsteriskExtChrome.PrefListener("extensions.asterisk.",
					function(branch, name)
					{
						switch (name)
						{
							case "statusicon":
								document.getElementById("asterisk-ext-status-icon").setAttribute("hidden", !branch.getBoolPref(name));
								break;
							case "statustextbox":
								document.getElementById("asterisk-ext-status-textbox").setAttribute("hidden", !branch.getBoolPref(name));
								break;
						}
					});
				AsteriskExtChrome.prefsListener.register();

				AsteriskExt.CallObserver.register();
				AsteriskExtChrome.CallObserver.register();
				
				/******************************************************************************/
				/* Manager instanciation                                                      */
				/******************************************************************************/
				
				AsteriskExt.initManager();

	
				var parsedocument = AsteriskExtChrome.ps.getBoolPref("extensions.asterisk.parsedocument");
				if( !parsedocument )
				{
					// firefox
				   	if(document.getElementById("contentAreaContextMenu"))
				   	{
				   		document.getElementById("contentAreaContextMenu").addEventListener(
				   			"popupshowing", AsteriskExtChrome.BrowserOverlay.onContentAreaContextMenu, true);
				   	}
					// thunderbird
					if(document.getElementById("mailContext"))
					{
				   		document.getElementById("mailContext").addEventListener(
				   			"popupshowing", AsteriskExtChrome.BrowserOverlay.onContentAreaContextMenu, true);
				   	}
					return;
				}
	

			//	var frame=null;
				// auto load for Firefox
			/*	frame = window.document.getElementById("appcontent");
				if( frame )
				{
					frame.addEventListener("DOMContentLoaded",parseDOM,false);
					//frame.addEventListener("DOMFrameContentLoaded",parseDOM,false);
				}
			*/
				// auto load for Thunderbird
			/*	frame = document.getElementById("messagepane");
				if( frame )
				{
					frame.addEventListener("DOMContentLoaded",parseDOM,false);
					//frame.addEventListener("DOMFrameContentLoaded",parseDOM,false);
				}
			*/

			},

			connectManager: function()
			{
				AsteriskExt.connectManager();
			},

			disconnectManager: function()
			{
				AsteriskExt.disconnectManager();
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


/*******************************************************************************
 * On Event functions
 ******************************************************************************/

			onContentAreaContextMenu: function()
			{
				var selection = "";
				// Firefox function : getBrowserSelection
				if( "undefined" != typeof(getBrowserSelection) ) {
					selection = getBrowserSelection();
				}
				else
				{
					selection = content.getSelection();
				}
				if( AsteriskExt.manager.isConnected() && selection )
				{
					var number = AsteriskExt.cleanPhoneNumber(selection);
					if( number.length > 0 )
					{
						document.getElementById("context-asterisk").label = AsteriskExtChrome.stringBundle.getString("menu_call")+" "+number;
						document.getElementById("context-asterisk").value = number;
						document.getElementById("context-asterisk-edit").label = AsteriskExtChrome.stringBundle.getString("menu_editcall")+" "+number;
						document.getElementById("context-asterisk-edit").value = number;
						document.getElementById("context-asterisk").hidden = false;
						document.getElementById("context-asterisk-edit").hidden = false;
					}
					else
					{
						document.getElementById("context-asterisk").hidden = true;
						document.getElementById("context-asterisk-edit").hidden = true;
					}
				}
				else
				{
					document.getElementById("context-asterisk").hidden = true;
					document.getElementById("context-asterisk-edit").hidden = true;
				}
			},

			statusDial: function()
			{
				var text = document.getElementById("asterisk-ext-status-textbox");
				AsteriskExt.dial(AsteriskExt.cleanPhoneNumber(text.value));
			},
			toolbarDial: function()
			{
				var text = document.getElementById("asterisk-ext-toolbar-textbox-item");
				AsteriskExt.dial(AsteriskExt.cleanPhoneNumber(text.value));
			},

			onStatusButtonMouseDown: function()
			{
				var popup = document.getElementById('asterisk-ext-popup');
				var panel = document.getElementById("asterisk-ext-statusbarpanel");

				if (popup.parentNode != panel)
					panel.appendChild(popup);

				popup.openPopup(panel, "before_start", 0, 0, true);
			},

			onToolbarButtonMouseDown: function()
			{
				var popup = document.getElementById('asterisk-ext-popup');
				var button = document.getElementById("asterisk-ext-toolbar-icon");

				if (popup.parentNode != button)
					button.appendChild(popup);

				switch( button.parentNode.getAttribute("id") )
				{
					case 'addon-bar':
						popup.openPopup(button, "before_start", 0, 0, true);
						break;
					case 'nav-bar':
						popup.openPopup(button, "after_start", 0, 0, true);
						break;
					default:
						popup.openPopup(button, "after_pointer", 0, 0, true);
						break;
				}
			},


			showStatusBarContextMenu: function()
			{
			},

			onStatusBarContextMenu: function(event)
			{
				var skipclipboard = false;
				var clip = Cc["@mozilla.org/widget/clipboard;1"].createInstance(Ci.nsIClipboard);
				if (clip)
				{
					var trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
					if (trans)
					{
						trans.addDataFlavor("text/unicode");
						clip.getData(trans,clip.kGlobalClipboard);
						var str=new Object();
						var strLength=new Object();
						try
						{
							trans.getTransferData("text/unicode",str,strLength);
						}
						catch(e)
						{
							skipclipboard = true;
						}
						if (!skipclipboard) 
						{
							str=str.value.QueryInterface(Ci.nsISupportsString);
							//var strobj=new String(str);
							var number = AsteriskExt.cleanPhoneNumber(str);
							if( AsteriskExt.manager.isConnected() && number.length > 0 )
							{
								document.getElementById("asterisk-ext-call-menuitem").label = AsteriskExtChrome.stringBundle.getString("menu_call")+" "+number;
								document.getElementById("asterisk-ext-call-menuitem").value = number;
								document.getElementById("asterisk-ext-call-menuitem").hidden = false;
							}
							else
							{
								skipclipboard = true;
								document.getElementById("asterisk-ext-call-menuitem").hidden = true;
							}
						}
					}
					else
					{
						skipclipboard = true;
					}
				}
				else
				{
					skipclipboard = true;
				}
	
				if(skipclipboard)
				{
					var selection = "";
					// Firefox function : getBrowserSelection
					if( "undefined" != typeof(getBrowserSelection) ) {
						selection = getBrowserSelection();
					}
					else
					{
						selection = content.getSelection();
					}
					if( AsteriskExt.manager.isConnected() && selection )
					{
						var number = AsteriskExt.cleanPhoneNumber(selection);
						if( number.length > 0 )
						{
							document.getElementById("asterisk-ext-call-menuitem").label = AsteriskExtChrome.stringBundle.getString("menu_call")+" "+number;
							document.getElementById("asterisk-ext-call-menuitem").value = number;
							document.getElementById("asterisk-ext-call-menuitem").hidden = false;
						}
						else
						{
							document.getElementById("asterisk-ext-call-menuitem").hidden = true;
						}
					}
					else
					{
						document.getElementById("asterisk-ext-call-menuitem").hidden = true;
					}
				}


				if( AsteriskExt.manager.requireConnection() )
				{
					if ( AsteriskExt.manager.isLoggedIn() )
					{
						document.getElementById("asterisk-ext-connect-menuitem").hidden = true;
						document.getElementById("asterisk-ext-disconnect-menuitem").hidden = false;
					}
					else 
					{
						document.getElementById("asterisk-ext-connect-menuitem").hidden = false;
						document.getElementById("asterisk-ext-disconnect-menuitem").hidden = true;
					}
				}
				else
				{
					document.getElementById("asterisk-ext-connect-menuitem").hidden = true;
					document.getElementById("asterisk-ext-disconnect-menuitem").hidden = true;
				}
			},

			/*******************************************************************************
			 * Open new Windows
			 ******************************************************************************/

			openOptionsWindow: function()
			{
				var windows = Components.classes['@mozilla.org/appshell/window-mediator;1']
					.getService(Components.interfaces.nsIWindowMediator)
					.getEnumerator(null);
				while (windows.hasMoreElements())
				{
					var win = windows.getNext();
					if (win.document.documentURI == "chrome://asterisk-ext/content/options.xul")
					{
						win.focus();
						return;
					}
				}
				window.openDialog("chrome://asterisk-ext/content/options.xul",
					"AsteriskExtPreferences",
					"chrome,titlebar,toolbar,centerscreen,modal",
					null);  
			},

			openHistoryWindow: function()
			{
				var windows = Components.classes['@mozilla.org/appshell/window-mediator;1']
					.getService(Components.interfaces.nsIWindowMediator)
					.getEnumerator(null);
				while (windows.hasMoreElements())
				{
					var win = windows.getNext();
					if (win.document.documentURI == "chrome://asterisk-ext/content/history.xul")
					{
						win.focus();
						return;
					}
				}
				window.openDialog("chrome://asterisk-ext/content/history.xul",
					"AsteriskExtHistory",
					"chrome,titlebar,toolbar,centerscreen",
					null);  
			},

			openAboutWindow: function()
			{
				var windows = Components.classes['@mozilla.org/appshell/window-mediator;1']
					.getService(Components.interfaces.nsIWindowMediator)
					.getEnumerator(null);
				while (windows.hasMoreElements())
				{
					var win = windows.getNext();
					if (win.document.documentURI == "chrome://asterisk-ext/content/about.xul")
					{
						win.focus();
						return;
					}
				}
				window.openDialog(
					"chrome://asterisk-ext/content/about.xul", 
					"AsteriskExtAbout",
					"chrome,centerscreen,modal",
					null);  
			},


		},
		
		/******************************************************************************/
		/* Observers                                                                  */
		/******************************************************************************/

		PrefListener: function(branchName, func)
		{
			var prefService = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefService);
			var branch = prefService.getBranch(branchName);
			branch.QueryInterface(Components.interfaces.nsIPrefBranch2);

			this.register = function()
			{
				branch.addObserver("", this, false);
				branch.getChildList("", { })
					.forEach(function (name) { func(branch, name); });
			};

			this.unregister = function()
			{
				if (branch)
					branch.removeObserver("", this);
			};

			this.observe = function(subject, topic, data)
			{
				if (topic == "nsPref:changed")
					func(branch, data);
			};
		},


		CallObserver: {
			stringBundle: null,

			QueryInterface: function (aIID) {
				if (aIID.equals(Ci.nsIObserver) ||
						aIID.equals(Ci.nsISupports) ||
						aIID.equals(Ci.nsISupportsWeakReference))
					return this;
				throw Components.results.NS_NOINTERFACE;
			},

			observe: function(subject, topic, data)
			{
				var toolbar_icon = document.getElementById("asterisk-ext-toolbar-icon");
				switch(topic)
				{
					case "asterisk-ext-error":
						AsteriskExt.logmessage(3, "gui received ERROR");
						document.getElementById("asterisk-ext-status-icon").setAttribute("class", "nok");
						if( toolbar_icon ) {
							toolbar_icon.setAttribute("class", "nok");
						}
						break;
					case "asterisk-ext-loggedin":
						AsteriskExt.logmessage(3, "gui received LOGGEDIN");
						document.getElementById("asterisk-ext-status-icon").setAttribute("class", "ok");
						if( toolbar_icon ) {
							toolbar_icon.setAttribute("class", "ok");
						}
						break;
					case "asterisk-ext-loggedout":
						AsteriskExt.logmessage(3, "gui received LOGGEDOUT");
						document.getElementById("asterisk-ext-status-icon").removeAttribute("class");
						if( toolbar_icon ) {
							toolbar_icon.removeAttribute("class");
						}
						break;
					case "asterisk-ext-close":
						AsteriskExt.logmessage(3, "gui received CLOSE");
						break;
				}
			},
	
			register: function()
			{
				var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
				obsService.addObserver(this, "asterisk-ext-error", true);
				obsService.addObserver(this, "asterisk-ext-loggedin", true);
				obsService.addObserver(this, "asterisk-ext-loggedout", true);
				obsService.addObserver(this, "asterisk-ext-close", true);
			},

			unregister: function()
			{
				var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
				try {
					obsService.removeObserver(this, "asterisk-ext-error");
					obsService.removeObserver(this, "asterisk-ext-loggedin");
					obsService.removeObserver(this, "asterisk-ext-loggedout");
					obsService.removeObserver(this, "asterisk-ext-close");
				} catch(e) {
					AsteriskExt.logmessage(1,"Error removing observers");
				}
			}
	
		},

	}
}

//if( window.getBrowser ) window.getBrowser().addEventListener("load", AsteriskExtChrome.BrowserOverlay.load, true);
window.addEventListener("load", AsteriskExtChrome.BrowserOverlay.load, true);

