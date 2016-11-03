
const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://asterisk-ext/asteriskext.js");


//@line 38 "/builds/slave/linux_build/build/toolkit/components/alerts/resources/content/alert.js"

// Copied from nsILookAndFeel.h, see comments on eMetric_AlertNotificationOrigin
const NS_ALERT_HORIZONTAL = 1;
const NS_ALERT_LEFT = 2;
const NS_ALERT_TOP = 4;

var gFinalSize;
var gCurrentSize = 1;

var gSlideIncrement = 2;
var gSlideTime = 10;
var gOpenTime = 3000; // total time the alert should stay up once we are done animating.
var gOrigin = 0; // Default value: alert from bottom right, sliding in vertically.

var gAlertListener = null;
var gAlertTextClickable = false;
var gAlertCookie = "";

var gStringBundle = null;

var gCallInfo = {
	direction: "unknown",
	Channel: "SIP/none-none",
	PeerChannel: "SIP/none-none",
	CallerIDName: "none",
	CallerIDNum: "0000",
	onRingTime: 0,
	onAnswerTime: 0,
	onHangupTime: 0
};

var gPrefs = Cc["@mozilla.org/preferences-service;1"].
	getService(Ci.nsIPrefBranch);

/******************************************************************************/
/* Console Logging function                                                   */
/******************************************************************************/

var cs = Cc["@mozilla.org/consoleservice;1"].
     getService(Ci.nsIConsoleService);

function logmessage(lvl, mes)
{
	if( gPrefs.getIntPref("extensions.asterisk.loglevel") >= lvl )
	{
		cs.logStringMessage(mes);
	}
}

var gManager = null;
if( gPrefs.getBoolPref("extensions.asterisk.manager") )
{
	gManager = AsteriskExt.AsteriskAMI;
}
else
{
	gManager = AsteriskExt.AsteriskAJAM;
}

var gTimer = Cc["@mozilla.org/timer;1"]
	.createInstance(Ci.nsITimer);


var popup = {

	load: function()
	{
		loadPopup();

		if( gPrefs.getBoolPref("extensions.asterisk.callpopup-autoopenurl") )
		{
			var obsService = Cc["@mozilla.org/observer-service;1"]
				.getService(Ci.nsIObserverService);
			obsService.notifyObservers(null, "asterisk-ext-click", gCallInfo.Channel);
		}
	},

	close: function()
	{
		//animateCloseAlert();
		closeAlert();
	},

	click: function()
	{
		var obsService = Cc["@mozilla.org/observer-service;1"]
			.getService(Ci.nsIObserverService);
		obsService.notifyObservers(null, "asterisk-ext-click", gCallInfo.Channel);
	},

	prefillAlertInfo: function()
	{
		gStringBundle = document.getElementById('asterisk-ext-strings');

	  // unwrap all the args....
	  // arguments[0] --> Call Data 

		switch (window.arguments.length)
		{
			default:
			case 1:
				gCallInfo = window.arguments[0];
				this.update();
				logmessage(3, "New Popup: "+gCallInfo.Channel +" / "+ gCallInfo.PeerChannel);
			case 0:
				switch(gCallInfo.direction)
				{
					case "incomming":
						document.getElementById('alertTitleLabel').setAttribute('value', 
							gStringBundle.getString("popup.incomming_call"));
						break;
					case "outgoing":
						document.getElementById('alertTitleLabel').setAttribute('value', 
							gStringBundle.getString("popup.outgoing_call"));
						break;
				}
				document.getElementById('alertStateLabel').setAttribute('value', 
					gStringBundle.getString("popup.ringing"));
				break;
		}
	},
	
	update: function()
	{
		switch(gCallInfo.direction)
		{
			case "incomming":
				document.getElementById('alertTextLabel').setAttribute('value', 
					gStringBundle.getString("popup.from")+" "+gCallInfo.CallerIDName+" ("+gCallInfo.CallerIDNum+")");
				break;
			case "outgoing":
				document.getElementById('alertTextLabel').setAttribute('value', 
					gStringBundle.getString("popup.to")+" "+gCallInfo.CallerIDNum+"");
				break;
		}
	},
	
	answer: function()
	{
		document.getElementById('alertTitleLabel').setAttribute('value', 
			gStringBundle.getString("popup.answered"));
		document.getElementById('hangupButton').setAttribute('label', 
			gStringBundle.getString("popup.hangup"));
		updateAnswer();
	},

	hangedup: false,
	
	hangup: function()
	{
		this.hangedup = true;
		var duration = 0;
		if ( (gCallInfo.onAnswerTime != 0) && (gCallInfo.onHangupTime != 0) )
		{
			duration = Math.round( ( gCallInfo.onHangupTime.getTime() - gCallInfo.onAnswerTime.getTime() ) / 1000 );
		}
		document.getElementById('alertTitleLabel').setAttribute('value', 
			gStringBundle.getString("popup.hangedup"));
		document.getElementById('alertStateLabel').setAttribute('value', 
			gStringBundle.getFormattedString("popup.duration", [duration]));

		// disable buttons
		document.getElementById('hangupButton').setAttribute('disabled', 'true');
		document.getElementById('transferButton').setAttribute('disabled', 'true');

		
		var event = {
			notify: function(timer) {
				popup.close();
			}
		};
		gTimer.initWithCallback(event, 5000, Ci.nsITimer.TYPE_ONE_SHOT); 
	},

	doHangup: function()
	{
		switch(gCallInfo.direction)
		{
			case "incomming":
				logmessage(3, "Popup HangUp: "+gCallInfo.Channel);
				gManager.hangup(gCallInfo.Channel, null);
				break;
			case "outgoing":
				logmessage(3, "Popup HangUp: "+gCallInfo.PeerChannel);
				gManager.hangup(gCallInfo.PeerChannel, null);
				break;
		}
	},

	doTransfer: function()
	{

		var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		var input = {value: ""};
		var check = {value: false};
		var result = prompts.prompt(window, "Asterisk Click2Dial", gStringBundle.getString("menu_call")+" ", input, null, check);
		if( result )
		{
			var context = gPrefs.getCharPref("extensions.asterisk.context");
			switch(gCallInfo.direction)
			{
				case "incomming":
					gManager.transfer(gCallInfo.PeerChannel, input.value, context, null);
					break;
				case "outgoing":
					gManager.transfer(gCallInfo.Channel, input.value, context, null);
					break;
			}
		}
	},
	
};

function updateAnswer()
{
	if( popup.hangedup ) return;
	var now = new Date();
	var duration = Math.round( ( now.getTime() - gCallInfo.onAnswerTime.getTime() ) / 1000 );
	document.getElementById('alertStateLabel').setAttribute('value', 
		gStringBundle.getFormattedString("popup.duration", [duration]));
	var event = {
		notify: function(timer) {
			updateAnswer();
		}
	};
	gTimer.initWithCallback(event, 1000, Ci.nsITimer.TYPE_ONE_SHOT); 
}


function loadPopup()
{
  // Read out our initial settings from prefs.
  try 
  {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService();
    prefService = prefService.QueryInterface(Components.interfaces.nsIPrefService);
    var prefBranch = prefService.getBranch(null);
    gSlideIncrement = prefBranch.getIntPref("alerts.slideIncrement");
    gSlideTime = prefBranch.getIntPref("alerts.slideIncrementTime");
    //gOpenTime = prefBranch.getIntPref("alerts.totalOpenTime");
    gOpenTime = prefBranch.getIntPref("extensions.asterisk.callpopup-timeout");
  }
  catch (ex)
  {
  }

  // Make sure that the contents are fixed at the window edge facing the
  // screen's center so that the window looks like "sliding in" and not
  // like "unfolding". The default packing of "start" only works for
  // vertical-bottom and horizontal-right positions, so we change it here.
  if (gOrigin & NS_ALERT_HORIZONTAL)
  {
    if (gOrigin & NS_ALERT_LEFT)
      document.documentElement.pack = "end";

    // Additionally, change the orientation so the packing works as intended
    document.documentElement.orient = "horizontal";
  }
  else
  {
    if (gOrigin & NS_ALERT_TOP)
      document.documentElement.pack = "end";
  }

  var alertBox = document.getElementById("alertBox");
  alertBox.orient = (gOrigin & NS_ALERT_HORIZONTAL) ? "vertical" : "horizontal";

  // The above doesn't cause the labels in alertTextBox to reflow,
  // see bug 311557. As the theme's -moz-box-align css rule gets ignored,
  // we work around the bug by setting the align property.
  if (gOrigin & NS_ALERT_HORIZONTAL)
  {
    document.getElementById("alertTextBox").align = "center";
  }

  sizeToContent();

  // Work around a bug where sizeToContent() leaves a border outside of the content
  var contentDim = document.getElementById("alertBox").boxObject;
  if (window.innerWidth == contentDim.width + 1)
    --window.innerWidth;

//@line 146 "/builds/slave/linux_build/build/toolkit/components/alerts/resources/content/alert.js"
  // Start with a 1px width/height, because 0 causes trouble with gtk1/2
  gCurrentSize = 1;

  // Determine final size
  /*
  if (gOrigin & NS_ALERT_HORIZONTAL)
  {
    gFinalSize = window.outerWidth;
    window.outerWidth = gCurrentSize;
  }
  else
  {
    gFinalSize = window.outerHeight;
    window.outerHeight = gCurrentSize;
  }
  */
//@line 161 "/builds/slave/linux_build/build/toolkit/components/alerts/resources/content/alert.js"

  // Determine position
  var x = gOrigin & NS_ALERT_LEFT ? screen.availLeft :
          screen.availLeft + screen.availWidth - window.outerWidth;
  var y = gOrigin & NS_ALERT_TOP ? screen.availTop :
          screen.availTop + screen.availHeight - window.outerHeight;

  // Offset the alert by 10 pixels from the edge of the screen
  if (gOrigin & NS_ALERT_HORIZONTAL)
    y += gOrigin & NS_ALERT_TOP ? 10 : -10;
  else
    x += gOrigin & NS_ALERT_LEFT ? 10 : -10;

  window.moveTo(x, y);

}


function loadPopupAnimated()
{
  // Read out our initial settings from prefs.
  try 
  {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService();
    prefService = prefService.QueryInterface(Components.interfaces.nsIPrefService);
    var prefBranch = prefService.getBranch(null);
    gSlideIncrement = prefBranch.getIntPref("alerts.slideIncrement");
    gSlideTime = prefBranch.getIntPref("alerts.slideIncrementTime");
    //gOpenTime = prefBranch.getIntPref("alerts.totalOpenTime");
    gOpenTime = prefBranch.getIntPref("extensions.asterisk.callpopup-timeout");
  }
  catch (ex)
  {
  }

  // Make sure that the contents are fixed at the window edge facing the
  // screen's center so that the window looks like "sliding in" and not
  // like "unfolding". The default packing of "start" only works for
  // vertical-bottom and horizontal-right positions, so we change it here.
  if (gOrigin & NS_ALERT_HORIZONTAL)
  {
    if (gOrigin & NS_ALERT_LEFT)
      document.documentElement.pack = "end";

    // Additionally, change the orientation so the packing works as intended
    document.documentElement.orient = "horizontal";
  }
  else
  {
    if (gOrigin & NS_ALERT_TOP)
      document.documentElement.pack = "end";
  }

  var alertBox = document.getElementById("alertBox");
  alertBox.orient = (gOrigin & NS_ALERT_HORIZONTAL) ? "vertical" : "horizontal";

  // The above doesn't cause the labels in alertTextBox to reflow,
  // see bug 311557. As the theme's -moz-box-align css rule gets ignored,
  // we work around the bug by setting the align property.
  if (gOrigin & NS_ALERT_HORIZONTAL)
  {
    document.getElementById("alertTextBox").align = "center";
  }

  sizeToContent();

  // Work around a bug where sizeToContent() leaves a border outside of the content
  var contentDim = document.getElementById("alertBox").boxObject;
  if (window.innerWidth == contentDim.width + 1)
    --window.innerWidth;

//@line 146 "/builds/slave/linux_build/build/toolkit/components/alerts/resources/content/alert.js"
  // Start with a 1px width/height, because 0 causes trouble with gtk1/2
  gCurrentSize = 1;

  // Determine final size
  if (gOrigin & NS_ALERT_HORIZONTAL)
  {
    gFinalSize = window.outerWidth;
    window.outerWidth = gCurrentSize;
  }
  else
  {
    gFinalSize = window.outerHeight;
    window.outerHeight = gCurrentSize;
  }
//@line 161 "/builds/slave/linux_build/build/toolkit/components/alerts/resources/content/alert.js"

  // Determine position
  var x = gOrigin & NS_ALERT_LEFT ? screen.availLeft :
          screen.availLeft + screen.availWidth - window.outerWidth;
  var y = gOrigin & NS_ALERT_TOP ? screen.availTop :
          screen.availTop + screen.availHeight - window.outerHeight;

  // Offset the alert by 10 pixels from the edge of the screen
  if (gOrigin & NS_ALERT_HORIZONTAL)
    y += gOrigin & NS_ALERT_TOP ? 10 : -10;
  else
    x += gOrigin & NS_ALERT_LEFT ? 10 : -10;

  window.moveTo(x, y);

//@line 177 "/builds/slave/linux_build/build/toolkit/components/alerts/resources/content/alert.js"
	var event = {
		notify: function(timer) {
			animateAlert();
		}
	};
	gTimer.initWithCallback(event, gSlideTime, Ci.nsITimer.TYPE_ONE_SHOT); 
//@line 181 "/builds/slave/linux_build/build/toolkit/components/alerts/resources/content/alert.js"
}

function animate(step)
{
  gCurrentSize += step;

  if (gOrigin & NS_ALERT_HORIZONTAL)
  {
    if (!(gOrigin & NS_ALERT_LEFT))
      window.screenX -= step;
    window.outerWidth = gCurrentSize;
  }
  else
  {
    if (!(gOrigin & NS_ALERT_TOP))
      window.screenY -= step;
    window.outerHeight = gCurrentSize;
  }
}

function animateAlert()
{
  if (gCurrentSize < gFinalSize)
  {
    animate(gSlideIncrement);
	var event = {
		notify: function(timer) {
			animateAlert();
		}
	};
	gTimer.initWithCallback(event, gSlideTime, Ci.nsITimer.TYPE_ONE_SHOT); 
  }
  else if ( gOpenTime != 0 )
  {
	var event = {
		notify: function(timer) {
			animateCloseAlert();
		}
	};
	gTimer.initWithCallback(event, gOpenTime*1000, Ci.nsITimer.TYPE_ONE_SHOT); 
  }
}

function animateCloseAlert()
{
  if (gCurrentSize > 1)
  {
    animate(-gSlideIncrement);
	var event = {
		notify: function(timer) {
			animateCloseAlert();
		}
	};
	gTimer.initWithCallback(event, gSlideTime, Ci.nsITimer.TYPE_ONE_SHOT); 
  }
  else
    closeAlert();
}

function closeAlert() {
  if (gAlertListener)
    gAlertListener.observe(null, "alertfinished", gAlertCookie); 
  window.close(); 
}

function onAlertClick()
{
  if (gAlertListener && gAlertTextClickable)
    gAlertListener.observe(null, "alertclickcallback", gAlertCookie);
  //closeAlert();
}
