
var Cc = Components.classes, Ci = Components.interfaces, Cu = Components.utils;

Cu.import("resource://asterisk-ext/asteriskext.js");

var gConsoleService = Cc["@mozilla.org/consoleservice;1"].
     getService(Ci.nsIConsoleService);

var gPrefs = Cc["@mozilla.org/preferences-service;1"].
	getService(Ci.nsIPrefBranch);


var gManager = null;
if( gPrefs.getBoolPref("extensions.asterisk.manager") )
{
	gManager = AsteriskExt.AsteriskAMI;
}
else
{
	gManager = AsteriskExt.AsteriskAJAM;
}

var gReloadConfig = false;

function options_onload(e)
{
	document.getElementById("asterisk-ext-manager").addEventListener("change", onChangeManagerPref, true);

	document.getElementById("asterisk-ext-host").addEventListener("change", onChangeServerPref, true);
	document.getElementById("asterisk-ext-port").addEventListener("change", onChangeServerPref, true);

	document.getElementById("asterisk-ext-showcallpopup").addEventListener("change", onChangeCallPopupPref, true);

	/*
	document.getElementById("asterisk-ext-username").addEventListener("change", onChangeManagerPref, true);
	document.getElementById("asterisk-ext-password").addEventListener("change", onChangeManagerPref, true);
	document.getElementById("asterisk-ext-context").addEventListener("change", onChangeManagerPref, true);
	document.getElementById("asterisk-ext-channel").addEventListener("change", onChangeManagerPref, true);
	*/
	onChangeCallPopupPref();
	changeManagerPref();

	// building ChannelType menulist 
	var prefTypes = gPrefs.getCharPref("extensions.asterisk.channeltypes");
	var channel = gPrefs.getCharPref("extensions.asterisk.channel");

	var menu = document.getElementById("asterisk-ext-channeltypes");
	
	var t = prefTypes.split(",");
	var selectedItem = null;
	for( i in t )
	{
		var item = menu.appendItem(t[i], t[i]);
		if( t[i] == channel )
		{
			selectedItem = item;
		}
	}
	menu.selectedItem = selectedItem;
	
	var username = gPrefs.getCharPref("extensions.asterisk.username");
	var pass;

	var user = gPrefs.getCharPref("extensions.asterisk.username");
	var myLoginManager = Cc["@mozilla.org/login-manager;1"]
		.getService(Ci.nsILoginManager);

	var nsLoginInfo = new Components.Constructor(
		"@mozilla.org/login-manager/loginInfo;1",  
		Ci.nsILoginInfo, "init"); 
	var loginInfo = new nsLoginInfo('chrome://asterisk-ext',
		null, 'Asterisk Manager User',
		username, pass, "", "");

	// Find users for the given parameters  
	var logins = myLoginManager.findLogins({}, 'chrome://asterisk-ext', null, 'Asterisk Manager User');  

	var oldLoginInfo = null;
	// Find user from returned array of nsILoginInfo objects  
	for (var i = 0; i < logins.length; i++)
	{
		if (logins[i].username == username)
		{
			pass = logins[i].password;
			break;
		}
	}
	document.getElementById("asterisk-ext-password").value = pass;
}

function options_unload(e)
{
	var username = gPrefs.getCharPref("extensions.asterisk.username");
	var pass = document.getElementById("asterisk-ext-password").value;
	if( pass != "" )
	{
		var user = gPrefs.getCharPref("extensions.asterisk.username");
		var myLoginManager = Cc["@mozilla.org/login-manager;1"]
			.getService(Ci.nsILoginManager);

		var nsLoginInfo = new Components.Constructor(
			"@mozilla.org/login-manager/loginInfo;1",  
			Ci.nsILoginInfo, "init"); 
		var loginInfo = new nsLoginInfo('chrome://asterisk-ext',
			null, 'Asterisk Manager User',
			username, pass, "", "");

		// Find users for the given parameters  
		var logins = myLoginManager.findLogins({}, 'chrome://asterisk-ext', null, 'Asterisk Manager User');  

		var oldLoginInfo = null;
		// Find user from returned array of nsILoginInfo objects  
		for (var i = 0; i < logins.length; i++)
		{
			if (logins[i].username == username)
			{
				oldLoginInfo = logins[i];
			}
			else
			{
				myLoginManager.removeLogin(logins[i]);
			}
		}

		if( oldLoginInfo == null )
		{
			//gConsoleService.logStringMessage("Inserting saved password into password manager");
			myLoginManager.addLogin(loginInfo);
		}
		else
		{
			//gConsoleService.logStringMessage("Modifying saved password into password manager");
			myLoginManager.modifyLogin(oldLoginInfo, loginInfo);
		}
	}

/*
	if( gReloadConfig )
	{
		var hostname = gPrefs.getCharPref("extensions.asterisk.host");
		var port = gPrefs.getCharPref("extensions.asterisk.port");
		if( !gPrefs.getBoolPref("extensions.asterisk.manager") )
		{
			gManager.open(hostname, port);
		}
		else if (gPrefs.getBoolPref("extensions.asterisk.autoconnect"))
		{
			gManager.open(hostname, port);
		}
	}*/

}

function testPopup()
{
	var data = {
		Channel: "SIP/test-test",
		PeerChannel: "SIP/test-test",
		CallerIDName: "test",
		CallerIDNum: "0000",
		onRingTime: 0,
		onAnswerTime: 0,
		onHangupTime: 0
	};

	var win = Cc['@mozilla.org/embedcomp/window-watcher;1']
		.getService(Ci.nsIWindowWatcher)
		.openWindow(null, 'chrome://asterisk-ext/content/popup.xul',
			'_blank', 'chrome,titlebar=no,popup=yes', null);
	win.arguments = [data]  ;

}

function changeManagerPref()
{
	if( gPrefs.getBoolPref("extensions.asterisk.manager") == true)
	{
		document.getElementById("showPopupCheckbox").removeAttribute("disabled");
		document.getElementById("autoconnectCheckbox").removeAttribute("disabled");
		document.getElementById("callPopupTestButton").removeAttribute("disabled");
		document.getElementById("callPopupTimeoutTextbox").removeAttribute("disabled");
		document.getElementById("callPopupURLTextbox").removeAttribute("disabled");
		document.getElementById("autoOpenURLCheckbox").removeAttribute("disabled");
		gPrefs.setCharPref("extensions.asterisk.port", "5038");
		onChangeCallPopupPref();
	}
	else
	{
		document.getElementById("showPopupCheckbox").setAttribute("disabled", true);
		document.getElementById("autoconnectCheckbox").setAttribute("disabled", true);
		document.getElementById("callPopupTestButton").setAttribute("disabled", true);
		document.getElementById("callPopupTimeoutTextbox").setAttribute("disabled", true);
		document.getElementById("callPopupURLTextbox").setAttribute("disabled", true);
		document.getElementById("autoOpenURLCheckbox").setAttribute("disabled", true);
		gPrefs.setCharPref("extensions.asterisk.port", "8088");
	}
}

function onChangeManagerPref()
{
	changeManagerPref();
	gReloadConfig = true;
}

function onChangeServerPref()
{
	gReloadConfig = true;
}

function onChangeCallPopupPref()
{
	if( gPrefs.getBoolPref("extensions.asterisk.callpopup") == true)
	{
		if( gManager.isLoggedIn() )
		{
			document.getElementById("callPopupTestButton").removeAttribute("disabled");
		}
		else
		{
			document.getElementById("callPopupTestButton").setAttribute("disabled", true);
		}
		document.getElementById("callPopupTimeoutTextbox").removeAttribute("disabled");
		document.getElementById("callPopupURLTextbox").removeAttribute("disabled");
	}
	else
	{
		document.getElementById("callPopupTestButton").setAttribute("disabled", true);
		document.getElementById("callPopupTimeoutTextbox").setAttribute("disabled", true);
		document.getElementById("callPopupURLTextbox").setAttribute("disabled", true);
	}
}

