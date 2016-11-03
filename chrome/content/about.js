
const EXTENSION_ID = "asterisk-ext@acipia.fr" ;

function about_onload()
{
	var extensionManager = Components.classes["@mozilla.org/extensions/manager;1"]
		.getService(Components.interfaces.nsIExtensionManager);
	var app = extensionManager.getItemForID(EXTENSION_ID);
	
	var strings = document.getElementById("asterisk-ext-strings");
	var text = strings.getFormattedString("version.label", [app.version]);
	document.getElementById("version").value = text;
}

