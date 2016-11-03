
var EXPORTED_SYMBOLS = ["AsteriskExt"];  

const Ci = Components.interfaces;
const Cc = Components.classes;

const _MESS_EVENT = 1 ;
const _MESS_RESPONSE = 2 ;


if ("undefined" == typeof(AsteriskExt)) {
	var AsteriskExt = {

		numberRegEx: /(\+[0-9]{1,3})?[^+]?([0-9]+[^+]{0,2})+[0-9]+/ ,

		ps: Cc["@mozilla.org/preferences-service;1"].
			getService(Ci.nsIPrefBranch),

		cs: Cc["@mozilla.org/consoleservice;1"].
    	getService(Ci.nsIConsoleService),
    
    storagefile: "asterisk-ext.sqlite",
    
    manager: this.AsteriskAMI,
    
    isInit: false,

/******************************************************************************/
/* Console Logging function                                                   */
/******************************************************************************/

		logmessage: function (lvl, mes)
		{
			if( this.ps.getIntPref("extensions.asterisk.loglevel") >= lvl )
			{
				this.cs.logStringMessage(mes);
			}
		},



/******************************************************************************/
/* Functions                                                                  */
/******************************************************************************/

		// auto-migration function
		updatePrefs: function ()
		{
			var chan = AsteriskExt.ps.getCharPref("extensions.asterisk.channel");

			// transform channel=SIP/5555 into channel=SIP extension=5555
			var pos = chan.indexOf("/");
			if( (0 < pos) && (pos < chan.length) )
			{
				var c = chan.substr(0, pos);
				var e = chan.substr(pos+1, chan.length - pos)
				AsteriskExt.logmessage(2, "old channel pref:"+chan);
				AsteriskExt.logmessage(2, "new channel pref:"+c);
				AsteriskExt.logmessage(2, "new extension pref:"+e);
				AsteriskExt.ps.setCharPref("extensions.asterisk.channel", c);
				AsteriskExt.ps.setCharPref("extensions.asterisk.extension", e);
			}

			var pass = null;
			try {
				pass = AsteriskExt.ps.getCharPref("extensions.asterisk.password");
			}
			catch(e)
			{
			}

			if( pass != null )
			{
				AsteriskExt.logmessage(2, "Inserting saved password into password manager");
				var user = AsteriskExt.ps.getCharPref("extensions.asterisk.username");
				var myLoginManager = Cc["@mozilla.org/login-manager;1"]
					.getService(Ci.nsILoginManager);

				var nsLoginInfo = new Components.Constructor(
					"@mozilla.org/login-manager/loginInfo;1",  
					Ci.nsILoginInfo, "init"); 
				var loginInfo = new nsLoginInfo('chrome://asterisk-ext',
					null, 'Asterisk Manager User',
					user, pass, "", "");

				try
				{
					myLoginManager.addLogin(loginInfo);
				}
				catch (e)
				{
					AsteriskExt.logmessage(2, "login already exists: "+e);
				}
				AsteriskExt.ps.clearUserPref("extensions.asterisk.password");
			}
		},

		initManager: function()
		{
			if( this.isInit ) return;
			
			/******************************************************************************/
			/* Init                                                                       */
			/******************************************************************************/
			
			if( AsteriskExt.ps.getBoolPref("extensions.asterisk.manager") )
			{
				AsteriskExt.logmessage(2, "Init. Using AMI");
				AsteriskExt.manager = AsteriskExt.AsteriskAMI;
			}
			else
			{
				AsteriskExt.logmessage(2, "Init. Using AJAM");
				AsteriskExt.manager = AsteriskExt.AsteriskAJAM;
			}
			
			/******************************************************************************/
			/* Auto connect                                                               */
			/******************************************************************************/

			try
			{
				if( AsteriskExt.ps.getBoolPref("extensions.asterisk.manager")  )
				{
					if( AsteriskExt.ps.getBoolPref("extensions.asterisk.autoconnect") )
					{
						AsteriskExt.connectManager();
					}
				}
				else
				{
					AsteriskExt.connectManager();
				}
			}
			catch(e)
			{
				AsteriskExt.logmessage(1, e);
			}
			
			this.isInit = true;
		},

		connectManager: function()
		{
			AsteriskExt.logmessage(2, "CALLED: connectManager");
		
			if( ! AsteriskExt.manager.isConnected() )
			{
				var hostname = AsteriskExt.ps.getCharPref("extensions.asterisk.host");
				var port = AsteriskExt.ps.getCharPref("extensions.asterisk.port");
				var channel = AsteriskExt.ps.getCharPref("extensions.asterisk.channel");
				var extension = AsteriskExt.ps.getCharPref("extensions.asterisk.extension");

				var username = AsteriskExt.ps.getCharPref("extensions.asterisk.username");
				var password;  

				try {
					// Get Login Manager
					var myLoginManager = Cc["@mozilla.org/login-manager;1"].
						getService(Ci.nsILoginManager);

					// Find users for the given parameters
					var logins = myLoginManager.findLogins({}, 'chrome://asterisk-ext', null, 'Asterisk Manager User');

					// Find user from returned array of nsILoginInfo objects
					for (var i = 0; i < logins.length; i++)
					{
						if (logins[i].username == username)
						{
							password = logins[i].password;
							break;
						}
					}
				}
				catch(ex) {  
					// This will only happen if there is no nsILoginManager component class  
				}  
				if( AsteriskExt.manager.open(hostname, port) )
				{
					if( ! AsteriskExt.manager.isLoggedIn() )
					{
						AsteriskExt.manager.login(username, ""+password, null);
						AsteriskExt.manager.setChannel(channel, extension);
					}
				}
				else
				{
					AsteriskExt.logmessage(2, "Cannot connect to Asterisk server");
				}
			}
			else
			{
				AsteriskExt.logmessage(1, "Manager already connected");
			}
		},

		disconnectManager: function()
		{
			AsteriskExt.logmessage(2, "CALLED: disconnectManager");
			if( AsteriskExt.manager.isLoggedIn() )
			{
				AsteriskExt.manager.logout();			
				//AsteriskExt.manager.close();
			}
		},

		/*******************************************************************************
		 * Dial Functions
		 ******************************************************************************/


		dial: function(phonenumber)
		{
			AsteriskExt.logmessage(1, "trying to call:"+phonenumber);
			if( phonenumber.length == 0 ) return;
			var prefix = AsteriskExt.ps.getCharPref("extensions.asterisk.prefix");
			var context = AsteriskExt.ps.getCharPref("extensions.asterisk.context");
			var channel = AsteriskExt.ps.getCharPref("extensions.asterisk.channel");
			var extension = AsteriskExt.ps.getCharPref("extensions.asterisk.extension");

			var priority = "1";
			var callerid = phonenumber;

			AsteriskExt.manager.originate(channel, extension, prefix+phonenumber, context, null);
		},


		cleanPhoneNumber: function(phoneNum)
		{
			var result;
			if( !(result = AsteriskExt.numberRegEx.exec(phoneNum)) ) return "";
			var number = new String(result[0]);
			number = number.replace(/[^0-9+]+/g,"");
			var len = number.length;

			if( len == 0 ) return "";

			var countrycode = AsteriskExt.ps.getCharPref("extensions.asterisk.countrycode");
			var nationalprefix = AsteriskExt.ps.getCharPref("extensions.asterisk.nationalprefix");
			var internationalprefix = AsteriskExt.ps.getCharPref("extensions.asterisk.internationalprefix");
			var cclen = countrycode.length;


			if( number.substr(0,1) == "+" )
			{
				if( number.substr(1,cclen) == countrycode )
				{
					var n = 0;
					if( number.substr(cclen+1, 1) == 0 )
					{ // removes any leading zero after country code
						n = 1;
					}
					number = nationalprefix + number.substr(cclen+n+1, len-cclen-n-1);
				}
				else
				{
					number = internationalprefix + number.substr(1,len-1);
				}
			}
			return number;
		},



/******************************************************************************/
/* Asterisk AJAM interface                                                    */
/******************************************************************************/

		AsteriskAJAM: {

			hostname: "pabx",
			port: "8088",
			username: null,
			password: null,
			baseurl: "http://pabx:8088/asterisk/mxml",
			connected: false,
			loggedIn: false,

			requireConnection: function ()
			{
				return false;
			},
	
			isConnected: function ()
			{
				return this.connected;
			},

			isLoggedIn: function()
			{
				return this.connected && this.loggedIn;
			},
	
			setChannel: function(chan, ext)
			{
				this.channel = chan;
				this.extension = ext;
				return true;
			},
	
			open: function (hostname, port)
			{
				this.hostname = hostname;
				this.port = port;
				this.baseurl = "http://"+this.hostname+":"+this.port+"/asterisk/mxml";
				this.connected = true;
				return true;
			},

			close: function ()
			{
				this.logout();
				this.connected = false;
			},

			login: function (username, password, onReady)
			{
				this.username = username;
				this.password = password;
				var url_login = this.baseurl +
					"?action=Login" +
					"&Username=" + username +
					"&Secret=" + password ;
				this.action(url_login, onReady);
			},

			logout: function (onReady)
			{
				var url_logoff = this.baseurl +
					"?action=Logoff";
				this.action(url_logoff, onReady);
				this.loggedIn = false;
			},

			originate: function (channel, extension, phonenumber, context, onReady)
			{
				if( this.isConnected() )
				{
					this.login(this.username, this.password, function(){
						var url_originate = AsteriskExt.AsteriskAJAM.baseurl +
							"?action=originate" +
							"&channel=" + channel +"/"+ extension +
							"&exten=" + phonenumber +
							"&context=" + context +
							"&CallerId=" + extension +
							"&priority=1" +
							"&codecs=alaw" +
							"&timeout=5000" ;
						AsteriskExt.AsteriskAJAM.action(url_originate, onReady);
					});
				}
			},

			action: function(url, onReady)
			{
				var xmlReq = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
				xmlReq.open("GET", url, true, null, null);
				xmlReq.onreadystatechange = function ()
				{
					if (xmlReq.readyState == 4)
					{
						if((xmlReq.status == 200) && (onReady!=null))
							onReady();
					}
				};  
				xmlReq.send("");
		/*		switch( xmlReq.status )
				{
					case 200 :
						break ;
					case 400 :
						alert("400 Bad Request") ;
						break;
					case 401 :
						alert("401 Unauthorized") ;
						break ;
					case 403 :
						talert("403 Wrong Client Version") ;
						break ;
					case 404 :
						alert("404 Not Found") ;
						break ;
					case 500 :
						alert("500 Internal Server Error") ;
						break ;
					default:
						alert( "Bad Status", "") ;
						break;
				}*/
	
				/*
				var response ;
				try
				{
					response = this._httpRequest.responseXML;
				}
				catch(e)
				{
					alert("Cannot get response") ;
				}
				alert(response);*/
			}
		},


/******************************************************************************/
/* Asterisk AMI interface                                                     */
/******************************************************************************/

		AsteriskAMI: {
	
			transport: null,
			outstream: null,

			// default parameters
			hostname: "pabx",
			port: "5038",

			connected: false,
			loggedIn: false,
			channels: new Array(),

			inputBuffer: "",

			requireConnection: function()
			{
				return true;
			},
	
			isConnected: function()
			{
				return this.connected;
			},

			isLoggedIn: function()
			{
				return this.connected && this.loggedIn;
			},

			setChannel: function(chan, ext)
			{
				this.channel = chan+"/"+ext;
				return true;
			},

			/**
			 * Open the socket and start reading it
			 */
			open: function (hostname, port)
			{
				this.hostname = hostname;
				this.port = port;
				try
				{
					this.transport = Cc["@mozilla.org/network/socket-transport-service;1"]
						.getService(Ci.nsISocketTransportService)
						.createTransport(null,0,this.hostname,this.port,null);
					this.connected = true;
				}
				catch (e)
				{
					AsteriskExt.logmessage(2, "cannot connect to server:\n"+e);
					return false;
				}
				try
				{
					this.outStream = this.transport.openOutputStream(0,0,0);
				}
				catch (e)
				{
					AsteriskExt.logmessage(2, "cannot open outputStream:\n"+e);
					return false;
				}

				try
				{
					var scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"];
					this.inStream = this.transport.openInputStream(0,0,0);
			
					this.pump = Cc["@mozilla.org/network/input-stream-pump;1"]
							.createInstance(Ci.nsIInputStreamPump); 
			
					this.pump.init(this.inStream, -1, -1, 0, 0, false);
			
					this.sInStream = scriptableInputStream.createInstance(Ci.nsIScriptableInputStream);
					this.sInStream.init(this.inStream);
			
					// init the stream parser with default values
					this.initParser();
			
					// start pumping Events
					this.pump.asyncRead(this, this); 
				}
				catch (e)
				{
					AsteriskExt.logmessage(2, "cannot open inputStream:\n"+e);
					return false;
				}
				return true;
			},
	
			close: function ()
			{
		 		var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
				obsService.notifyObservers(null, "asterisk-ext-close", null);
				this.sInStream.close();
				this.inStream.close();
				this.outStream.close();
				this.transport.close(null);
				this.connected = false;
				this.loggedIn = false;
			},

			/**
			 * Called when data is available on the socket
			 * read the buffer and run the parser
			 */
			onDataAvailable: function()
			{
				if( this.transport.isAlive() )
				{
					var data="";
					while(true)
					{
						var buf = this.sInStream.read(1024);
						if( buf.length == 0 ) break;
						data += buf;
				 	}
					this.parseData(data);
		 		}
		 		else if( this.connected )
		 		{
			 		var obsService = Cc["@mozilla.org/observer-service;1"]
						.getService(Ci.nsIObserverService);
		 			if( ! this.loggedIn )
		 			{
		 				// seems the nsIScriptableInputStream becames unreadable when the server closes the connection
		 				// Here, I get some available data but I cannot read it, means Login error
						obsService.notifyObservers(null, "asterisk-ext-error", "Login error");
		 			}
		 			else
		 			{
						obsService.notifyObservers(null, "asterisk-ext-error", "Socket Read error");
			 			//this.close();
					}
		 		}
			},
	
			onStartRequest: function(aRequest, aContext)
			{
			},
	
			onStopRequest: function(aRequest, aContext, aStatusCode)
			{
		 		var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
				if( ! this.loggedIn )
				{
					// pump is closed before I can read some data
					obsService.notifyObservers(null, "asterisk-ext-error", "Cannot connect to server");
				}
				else
				{
					obsService.notifyObservers(null, "asterisk-ext-error", "Socket Closed");
				}
				this.close();
			},


			initParser: function()
			{
				this.parserHasMessage = false;
				this.parserMessageType = 0;
				this.parserObject = {};
			},
	
			/**
			 * parse received data from the socket and call doEvent
			 */
			parseData: function(data)
			{
				 	AsteriskExt.logmessage(9, data);
				var lines = data.split("\r\n");
				lines.pop(); // remove the last element has it is always a blank line we do not want to parse
				for( i in lines )
				{
					if( lines[i] == "" )
					{
						if( this.parserHasMessage )
						{
							switch(this.parserMessageType)
							{
								case _MESS_EVENT :
									this.handleEvent(this.parserObject);
									break;
								case _MESS_RESPONSE :
									this.handleResponse(this.parserObject);
									break;
							}
						}
						this.initParser();
					}
					else
					{
						if( !this.parserHasMessage && (lines[i].substr(0, 7) == "Event: ") )
						{
							this.parserObject.Event = lines[i].substr(7);
							this.parserHasMessage = true;
							this.parserMessageType = _MESS_EVENT;
						}
						else if( !this.parserHasMessage && (lines[i].substr(0, 10) == "Response: ") )
						{
							this.parserObject.Response = lines[i].substr(10);
							this.parserHasMessage = true;
							this.parserMessageType = _MESS_RESPONSE;
						}
						else
						{
							var pos = lines[i].indexOf(":");
							if( pos != -1 )
							{
								// TODO : should be improved here to test values
								var key = lines[i].substr(0, pos);
								var value = lines[i].substr(pos+2);
								this.parserObject[key] = value;
							}
						}
					}
				}
			},
	
			/**
			 * test is we have the channel in call queue
			 */
			hasChannel: function(channel)
			{
				for( i in this.channels )
				{
					if( this.channels[i].Channel == channel ) return true;
				}
				return false;
			},

			/**
			 * get the call based on the channel
			 */
			getChannel: function(channel)
			{
				for( i in this.channels )
				{
					if( this.channels[i].Channel == channel ) return this.channels[i];
				}
				return null;
			},

			/**
			 * get and unqueue the call based on the channel
			 */
			popChannel: function(channel)
			{
				for( i in this.channels )
				{
					if( this.channels[i].Channel == channel )
					{
						e = this.channels.splice(i,1);
						return e[0];
					}
				}
				return null;
			},	

			/**
			 * push the call based on the channel
			 */
			pushChannel: function(channel)
			{
				this.channels.push(channel);
			},	

			/**
			 * handle the Response, called from the parser
			 */
			handleResponse: function(response)
			{
				var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);

				switch ( response.Response )
				{
					case "Error":
						AsteriskExt.logmessage(2, "Error: "+response.Message);
						break;
					case "Success":
						AsteriskExt.logmessage(2, "Success: "+response.Message);
						if( response.Message == "Authentication accepted" )
						{
							this.loggedIn = true;
							obsService.notifyObservers(null, "asterisk-ext-loggedin", "Logged In");
						}
						break;
					default:
						var d = "";
						for( i in response )
						{
							d += i+": "+response[i]+"\n";
						}
						AsteriskExt.logmessage(2, "UNKNOWN RESPONSE:\n"+d);
						break;
				}
			},
	
			/**
			 * run the Event, called from the parser
			 */
			handleEvent: function(event)
			{
				var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
				 	
				switch( event.Event )
				{
					case "Newchannel":
						if( event.Channel )
						{
							var chanlen = event.Channel.indexOf("-");
							if( event.Channel.substr(0,chanlen) == this.channel )
							{
								var data = {
									state: "init",
									direction: "unknown",
									Channel: event.Channel,
									PeerChannel: null,
									CallerIDName: "",
									CallerIDNum: "",
									onRingTime: 0,
									onAnswerTime: 0,
									onHangupTime: 0
								};
								this.pushChannel(data);
								AsteriskExt.logmessage(5, "NewChannel: Channels Array length: "+this.channels.length);
							}
						}
						break;
					case "Dial":
						if( !event.Destination ) break;
						if( this.hasChannel(event.Destination) )
						{
							var calleridnum = undefined;
							if( event.CallerID != undefined )
							{ // ast 1.4
								calleridnum = event.CallerID;
							}
							if( event.CallerIDNum != undefined )
							{ // ast 1.6
								calleridnum = event.CallerIDNum;
							}
							AsteriskExt.logmessage(2, "Detected Incomming Dial From: "+calleridnum+" / "+event.CallerIDName);
							var data = this.popChannel(event.Destination);
							data.state = "dialed";
							data.direction = "incomming";
							data.PeerChannel = event.Channel;
							data.CallerIDName = event.CallerIDName;
							data.CallerIDNum = calleridnum;
							this.pushChannel(data);
							obsService.notifyObservers(data, "asterisk-ext-dial", event.Destination);
						}
						else if ( this.hasChannel(event.Channel) )
						{
							AsteriskExt.logmessage(2, "Detected Outgoing Dial From: "+event.Channel);
							var data = this.popChannel(event.Channel);
							data.state = "dialed";
							data.direction = "outgoing";
							data.Channel = event.Destination;
							data.PeerChannel = event.Channel;
							this.pushChannel(data);
							obsService.notifyObservers(data, "asterisk-ext-dial", event.Channel);
						}
						break;
					case "Hangup":
						if( event.Channel )
						{
							if( this.hasChannel(event.Channel) )
							{
								var data = this.getChannel(event.Channel);
								data.state = "hungup";
								data.onHangupTime = new Date();
								var d = "0";
								if( data.onAnswerTime != 0 )
									d = data.onHangupTime.getTime() - data.onAnswerTime.getTime();
								AsteriskExt.logmessage(2, "Detected Hangup From: "+data.CallerIDNum+" / "+data.CallerIDName+" call duration: "+d);
								obsService.notifyObservers(data, "asterisk-ext-hangup", event.Channel);
								AsteriskExt.logmessage(5, "Hangup: Channels Array length: "+this.channels.length);
							}
						}
						else
						{
							AsteriskExt.logmessage(2, "Error on Hangup, could not find channel");
						}
						break;
					case "Newstate":
						if( event.Channel )
						{
							if( this.hasChannel(event.Channel)	 )
							{
								var data = this.getChannel(event.Channel);
								var stateDesc = undefined;
								if( event.State != undefined )
								{ // ast 1.4
									stateDesc = event.State;
								}
								else if( event.ChannelStateDesc != undefined )
								{ // ast 1.6
									stateDesc = event.ChannelStateDesc;
								}
								switch( stateDesc )
								{
								case "Ring":
								case "Ringing":
									data.state = "ringing";
									switch( data.direction )
									{
										case "incomming":
											AsteriskExt.logmessage(2, "Incomming Call Ringing: "+data.CallerIDNum+" / "+data.CallerIDName);
											data.onRingTime = new Date();
											obsService.notifyObservers(data, "asterisk-ext-ring", event.Channel);
											break;
										case "outgoing":
											//data.CallerIDNum = event.CallerIDNum;
											AsteriskExt.logmessage(2, "Outgoing Call Ringing: "+data.CallerIDNum);
											data.onRingTime = new Date();
											obsService.notifyObservers(data, "asterisk-ext-ring", event.Channel);
											break;
										default:
											// unknown calls comes up when using Queues or similar applications
											// setting them as incomming
											data.direction = "incomming";
											var calleridnum = undefined;
											if( event.CallerID != undefined )
											{ // ast 1.4
												calleridnum = event.CallerID;
											}
											if( event.CallerIDNum != undefined )
											{ // ast 1.6
												calleridnum = event.CallerIDNum;
											}
											data.CallerIDNum = calleridnum;
											data.CallerIDName = event.CallerIDName;
											data.onRingTime = new Date();
											AsteriskExt.logmessage(2, "No direction Call Ringing: "+data.CallerIDNum);
											obsService.notifyObservers(data, "asterisk-ext-ring", event.Channel);
											break;
									}
									break;
								case "Up":
									data.state = "up";
									switch( data.direction )
									{
										case "incomming":
											AsteriskExt.logmessage(3, "Incomming Call Answered: "+data.CallerIDNum+" / "+data.CallerIDName+" chan: "+event.Channel);
											data.onAnswerTime = new Date();
											obsService.notifyObservers(data, "asterisk-ext-answer", event.Channel);
											break;
										case "outgoing":
											AsteriskExt.logmessage(3, "Outgoing Call Answered: "+data.CallerIDNum+" chan: "+event.Channel);
											data.onAnswerTime = new Date();
											obsService.notifyObservers(data, "asterisk-ext-answer", event.Channel);
											break;
										default:
											AsteriskExt.logmessage(3, "No direction Call Answered: "+data.CallerIDNum+" chan: "+event.Channel);
											data.onAnswerTime = new Date();
											obsService.notifyObservers(data, "asterisk-ext-answer", event.Channel);
											break;
									}
									break;
								default:
									AsteriskExt.logmessage(2, data.Channel+" State "+stateDesc+" : "+data.CallerIDNum+" / "+data.CallerIDName);
									break;
								}
							}
							else
							{
								AsteriskExt.logmessage(5, "Not our Newstate, could not find channel: "+event.Channel);
							}
						}
						else
						{
							AsteriskExt.logmessage(2, "Error on Newstate, could not find Channel in the event");
						}
						break;
					case "Rename":
						if( event.Channel )
						{
							if( this.hasChannel(event.Channel)	 )
							{
								var data = this.popChannel(event.Channel);
								AsteriskExt.logmessage(2, "Renaming "+data.Channel+" into "+event.Newname);
								data.Channel = event.Newname;
								this.pushChannel(data);
							}
						}
						else
						{
							AsteriskExt.logmessage(2, "Error on Rename, could not find channel");
						}
						break;
					// only useful with an outgoing call
					case "NewCallerid":
						if( event.Channel )
						{
							if( this.hasChannel(event.Channel)	 )
							{
								var data = this.popChannel(event.Channel);
								switch( data.direction )
								{
									case "outgoing":
										AsteriskExt.logmessage(2, "Adding callerid "+event.CallerIDNum);
										var calleridnum = undefined;
										if( event.CallerID != undefined )
										{ // ast 1.4
											calleridnum = event.CallerID;
										}
										if( event.CallerIDNum != undefined )
										{ // ast 1.6
											calleridnum = event.CallerIDNum;
										}
										data.CallerIDNum = calleridnum;
										data.CallerIDName = event.CallerIDName;
										break;
								}
								this.pushChannel(data);
								obsService.notifyObservers(data, "asterisk-ext-calleridupdate", event.Channel);
							}
						}
						else
						{
							AsteriskExt.logmessage(2, "Error on NewCallerid, could not find channel");
						}
						break;
					// Ignoring these
					case "Registry":
					case "PeerStatus":
					case "Bridge":
					case "ExtensionStatus":
					case "Unlink":
					case "NewAccountCode":
					case "ChannelUpdate":
					case "Masquerade":
					case "Hold":
					case "MusicOnHold":
					case "Transfer":
					case "ParkedCallGiveUp":
					case "ParkedCall":
						break;
					default:
						var d = "";
						for( i in event )
						{
							d += i+": "+event[i]+"\n";
						}
						AsteriskExt.logmessage(8, "UNKNOWN EVENT:\n"+d);
						break;
				}
			},
	
			/**
			 * login
			 * Manager Function
			 */
			login: function (username, password, onReady)
			{
				var outputData = "Action: Login\r\n"
				+ "Username: " + username  + "\r\n"
				+ "Secret: " + password  + "\r\n"
		//		+ "Events: on\r\n"
		//		+ "Events: off\r\n"
				+ "\r\n";
				this.action(outputData,onReady);
				 	AsteriskExt.logmessage(7, "login: "+username+"/"+password);
			},

			/**
			 * logout
			 * Manager Function
			 */
			logout: function (onReady)
			{
				var outputData = "Action: Logoff\r\n\r\n";
				this.action(outputData,onReady);
				 	AsteriskExt.logmessage(2, "logout");
				this.loggedIn = false;
		 		var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
				obsService.notifyObservers(null, "asterisk-ext-loggedout", null);
			},

			/**
			 * originate
			 * Manager Function
			 */
			originate: function (channel, extension, phonenumber, context, onReady)
			{
				var outputData = "Action: Originate\r\n"
				+ "Exten: " + phonenumber + "\r\n"
				+ "Context: " + context + "\r\n"
				+ "Priority: 1\r\n"
				+ "Channel: " + channel +"/"+ extension + "\r\n"
				+ "Callerid: " + extension + "\r\n"
				+ "Async: true\r\n"
				+ "Timeout: 5000\r\n\r\n";
				this.action(outputData,onReady);
			},

		// Some header for auto answer
		//		+ "Variable: SIPAddHeader=Call-Info:\\\\; answer-after=0\r\n"

		// Aaastra header for auto answer
		//		+ "Variable: SIPAddHeader=Alert-Info: info=alert-autoanswer\r\n"


			/**
			 * hangup
			 * Manager Function
			 */
			hangup: function (channel, onReady)
			{
				var outputData = "Action: Hangup\r\n"
				+ "Channel: " + channel + "\r\n"
				+ "\r\n";
				this.action(outputData,onReady);
			},

			/**
			 * transfer
			 * Manager Function
			 */
			transfer: function (channel, phonenumber, context, onReady)
			{
				var outputData = "Action: Redirect\r\n"
				+ "Exten: " + phonenumber + "\r\n"
				+ "Context: " + context + "\r\n"
				+ "Priority: 1\r\n"
				+ "Channel: " + channel + "\r\n"
				+ "\r\n";
				this.action(outputData,onReady);
			},

	
			/**
			 * action
			 * write the command
			 */
			action: function(outputData, onReady)
			{
				this.outStream.write(outputData,outputData.length);
				if( onReady != null )
					onReady();
			}
		},

/******************************************************************************/
/* Storage instanciation                                                      */
/******************************************************************************/

		Storage: {

			conn : null,

			open: function() {
				if( this.conn != null ) return 1;
				var file = Cc["@mozilla.org/file/directory_service;1"]  
					.getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
				file.append(AsteriskExt.storagefile);
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

		/******************************************************************************
		 * CALL History Functions
		 ******************************************************************************/

			addCall: function(data) {
				if( this.conn == null ) return 0;
				var stmt = this.conn.createStatement(
					'INSERT INTO "history" \
						("number","name","direction","ringtime","answertime","hanguptime") VALUES \
						(:number ,:name ,:direction ,:ringtime ,:answertime ,:hanguptime)' );
				stmt.params.number = data.CallerIDNum;
				stmt.params.name = data.CallerIDName;
				stmt.params.direction = data.direction;
				stmt.params.ringtime = Math.round(data.onRingTime/1000);
				stmt.params.answertime = Math.round(data.onAnswerTime/1000);
				stmt.params.hanguptime = Math.round(data.onHangupTime/1000);
				AsteriskExt.logmessage(3, "Adding Call in history, "+data.direction+" "+data.CallerIDNum);
				stmt.executeAsync();
			},

			searchPhoneNumber: function(number, callback) {
				var stmt = this.conn.createStatement(
					'SELECT "number", "name", "direction", "ringtime", "answertime", "hanguptime" \
					FROM "history" WHERE number LIKE ":number%"');
				stmt.params.number = number;
		
				stmt.executeAsync({
					handleResult: function(aResultSet) {
						for (let row = aResultSet.getNextRow();
							row;
							row = aResultSet.getNextRow())
						{
							let value = row.getResultByName("column_name");
						}
					},

					handleError: function(aError) {
						AsteriskExt.logmessage(3, "Error: " + aError.message);
					},

					handleCompletion: function(aReason) {
						if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED)
							AsteriskExt.logmessage(3, "Query canceled or aborted!");
					}
				});
		
			},


		},

/******************************************************************************/
/* Observer instanciation                                                     */
/******************************************************************************/

		CallObserver: {

			registered: false,
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
				var obj = null;
				if( AsteriskExt.AsteriskAMI.hasChannel(data) )
				{
					obj = AsteriskExt.AsteriskAMI.getChannel(data);
				}
				else
				{
					return 1;
				}
				switch(topic)
				{
					case "asterisk-ext-dial":
						break;
					case "asterisk-ext-ring":
						if( AsteriskExt.ps.getBoolPref("extensions.asterisk.callpopup") )
						{
							if( !obj.popup )
							{
								AsteriskExt.logmessage(2, "Opening Call popup");
								var win = Cc['@mozilla.org/embedcomp/window-watcher;1']
									.getService(Ci.nsIWindowWatcher)
									.openWindow(null, 'chrome://asterisk-ext/content/popup.xul',
										'_blank', 'chrome,titlebar=no,popup=yes', null);
								win.arguments = [obj]  ;
								obj.popup = win;
							}
							else
							{
								AsteriskExt.logmessage(2, "Call popup already opened");
								obj.popup.popup.update();
							}
						}
						break;
					case "asterisk-ext-calleridupdate":
						if( AsteriskExt.ps.getBoolPref("extensions.asterisk.callpopup") )
						{
							if( obj.popup && obj.popup.popup )
							{
								obj.popup.popup.update();
							}
						}
						break;
					case "asterisk-ext-answer":
						if( AsteriskExt.ps.getBoolPref("extensions.asterisk.callpopup") )
						{
							if( obj.popup && obj.popup.popup )
							{
								obj.popup.popup.update();
								obj.popup.popup.answer();
							}
						}
						break;
					case "asterisk-ext-hangup":
						AsteriskExt.Storage.addCall(obj);
						if( AsteriskExt.ps.getBoolPref("extensions.asterisk.callpopup") )
						{
							if( obj && obj.popup )
							{
								obj.popup.popup.hangup();
								AsteriskExt.AsteriskAMI.popChannel(data)
							}
						}
						break;
					case "asterisk-ext-error":
						AsteriskExt.logmessage(1, "Socket error: "+data);
						break;
					case "asterisk-ext-click":
						var url = AsteriskExt.ps.getCharPref("extensions.asterisk.callpopup-url");
						url = url.replace( /#NUM#/g , obj.CallerIDNum );
						AsteriskExt.openAndReuseOneTabPerAttribute("number", obj.CallerIDNum, url);
						break;
					case "asterisk-ext-loggedin":
						AsteriskExt.logmessage(3, "Logged In");
						break;
					case "asterisk-ext-loggedout":
						AsteriskExt.logmessage(3, "Logged Out");
						break;
					case "asterisk-ext-close":
						AsteriskExt.logmessage(3, "Connection closed");
						break;
				}
			},
	
			register: function()
			{
				if( this.registered ) return;
				var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
				obsService.addObserver(this, "asterisk-ext-dial", true);
				obsService.addObserver(this, "asterisk-ext-ring", true);
				obsService.addObserver(this, "asterisk-ext-calleridupdate", true);
				obsService.addObserver(this, "asterisk-ext-answer", true);
				obsService.addObserver(this, "asterisk-ext-hangup", true);
				obsService.addObserver(this, "asterisk-ext-error", true);
				obsService.addObserver(this, "asterisk-ext-click", true);
				obsService.addObserver(this, "asterisk-ext-loggedin", true);
				obsService.addObserver(this, "asterisk-ext-loggedout", true);
				obsService.addObserver(this, "asterisk-ext-close", true);
				this.registered = true;
			},

			unregister: function()
			{
				var obsService = Cc["@mozilla.org/observer-service;1"]
					.getService(Ci.nsIObserverService);
				try {
					obsService.removeObserver(this, "asterisk-ext-dial");
					obsService.removeObserver(this, "asterisk-ext-ring");
					obsService.removeObserver(this, "asterisk-ext-calleridupdate");
					obsService.removeObserver(this, "asterisk-ext-answer");
					obsService.removeObserver(this, "asterisk-ext-hangup");
					obsService.removeObserver(this, "asterisk-ext-error");
					obsService.removeObserver(this, "asterisk-ext-click");
					obsService.removeObserver(this, "asterisk-ext-loggedin");
					obsService.removeObserver(this, "asterisk-ext-loggedout");
					obsService.removeObserver(this, "asterisk-ext-close");
				} catch(e) {
					AsteriskExt.logmessage(3, "Error removing observers");
				}
				this.registered = false;
			}
		},

		// function from MDC, modified to introduce the phone number as a value
		openAndReuseOneTabPerAttribute: function(attrName, attrValue, url)
		{
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator);
			for (var found = false, index = 0, tabbrowser = wm.getEnumerator('navigator:browser').getNext().gBrowser;
				index < tabbrowser.tabContainer.childNodes.length && !found;
				index++)
			{

				// Get the next tab
				var currentTab = tabbrowser.tabContainer.childNodes[index];

				// Does this tab contain our custom attribute?
				if (currentTab.hasAttribute(attrName))
				{
					var v = currentTab.getAttribute(attrName);
					if( v == attrValue )
					{
						// Yes--select and focus it.
						tabbrowser.selectedTab = currentTab;

						// Focus *this* browser window in case another one is currently focused
						tabbrowser.ownerDocument.defaultView.focus();
						found = true;
					}
				}
			}

			if (!found)
			{
				// Our tab isn't open. Open it now.
				var browserEnumerator = wm.getEnumerator("navigator:browser");
				var tabbrowser = browserEnumerator.getNext().gBrowser;

				// Create tab
				var newTab = tabbrowser.addTab(url);
				newTab.setAttribute(attrName, attrValue);

				// Focus tab
				tabbrowser.selectedTab = newTab;

				// Focus *this* browser window in case another one is currently focused
				tabbrowser.ownerDocument.defaultView.focus();
			}
		},

	}
}

