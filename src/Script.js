/* Script.js
 *  Script object
 */

function scriptEditorInit() {
    //Initialize save and close button
    var closeButton = document.getElementById("script-editor-save-and-close-button");
    
    closeButton.addEventListener("click", function() {
        saveAndCloseScriptEditor();
        return false;
    });
    
    //Allow tabs (four spaces) in all textareas
    var textareas = document.getElementsByTagName('textarea');
    var count = textareas.length;
    for(var i=0;i<count;i++){
        textareas[i].onkeydown = function(e){
            if(e.keyCode==9 || e.which==9){
                e.preventDefault();
                var start = this.selectionStart;
                var end = this.selectionEnd;

                //Set textarea value to: text before caret + four spaces + text after caret
                spaces = "    ";
                this.value = this.value.substring(0, start) + spaces + this.value.substring(end);

                //Put caret at after the four spaces
                this.selectionStart = this.selectionEnd = start + spaces.length;
            }
        }
    }
};
document.addEventListener("DOMContentLoaded", scriptEditorInit, false);

//Define key commands in script editor (ctrl o to save + close, etc.)
$(document).keydown(function(e) {
	if (Engine.currentPage == Engine.Page.ScriptEditor) {
		//Ctrl + b
        if (e.keyCode == 66 && e.ctrlKey) {
            e.preventDefault();
			saveAndCloseScriptEditor();
        }
	}
});

function saveAndCloseScriptEditor() {
    var filename = document.getElementById("script-editor-filename").value;
    if (iTutorialIsRunning && currITutorialStep == iTutorialSteps.TerminalTypeScript) {
        if (filename != "foodnstuff") {
            dialogBoxCreate("Leave the script name as 'foodnstuff'!");
            return;
        }
        var code = document.getElementById("script-editor-text").value;
        code = code.replace(/\s/g, "");
        if (code.indexOf("while(true){hack('foodnstuff');}") == -1) {
            dialogBoxCreate("Please copy and paste the code from the tutorial!");
            return;
        }
        iTutorialNextStep(); 
    }
    
    if (filename == "") {
        //If no filename...just close and do nothing
        Engine.loadTerminalContent();
        return;
    }
        
    if (checkValidFilename(filename) == false) {
        dialogBoxCreate("Script filename can contain only alphanumerics, hyphens, and underscores");
        return;
    }
    
    filename += ".script";
    
    //If the current script matches one thats currently running, throw an error
    for (var i = 0; i < Player.getCurrentServer().runningScripts.length; i++) {
        if (filename == Player.getCurrentServer().runningScripts[i].filename) {
            dialogBoxCreate("Cannot write to script that is currently running!");
            return;
        }
    }
    
    //If the current script already exists on the server, overwrite it
    for (var i = 0; i < Player.getCurrentServer().scripts.length; i++) {
        if (filename == Player.getCurrentServer().scripts[i].filename) {
            Player.getCurrentServer().scripts[i].saveScript();
            Engine.loadTerminalContent();
            return;
        }
    }
    
    //If the current script does NOT exist, create a new one
    var script = new Script();
    script.saveScript();
    Player.getCurrentServer().scripts.push(script);
    Engine.loadTerminalContent();
}

//Checks that the string contains only valid characters for a filename, which are alphanumeric,
// underscores and hyphens
function checkValidFilename(filename) {
	var regex = /^[a-zA-Z0-9_-]+$/;
	
	if (filename.match(regex)) {
		return true;
	}
	return false;
}

function Script() {    
	this.filename 	= "";
    this.code       = "";
    this.ramUsage   = 0;
	this.server 	= "";	//IP of server this script is on
    this.logs       = [];   //Script logging. Array of strings, with each element being a log entry
    
    /* Properties to calculate offline progress. Only applies for infinitely looping scripts */
	//Stats to display on the Scripts menu, and used to determine offline progress
	this.offlineRunningTime  	= 0.01;	//Seconds
	this.offlineMoneyMade 		= 0;
	this.offlineExpGained 		= 0;
	this.onlineRunningTime 		= 0.01;	//Seconds
	this.onlineMoneyMade 		= 0;
	this.onlineExpGained 		= 0;
	
    this.moneyStolenMap         = new AllServersToMoneyMap();
};

//Get the script data from the Script Editor and save it to the object
Script.prototype.saveScript = function() {
	if (Engine.currentPage == Engine.Page.ScriptEditor) {
		//Update code and filename
		var code = document.getElementById("script-editor-text").value;
		this.code = code.replace(/^\s+|\s+$/g, '');
		
		var filename = document.getElementById("script-editor-filename").value + ".script";
		this.filename = filename;
		
		//Server
		this.server = Player.currentServer;
		
		//Calculate/update ram usage, execution time, etc. 
		this.updateRamUsage();
		
		//Clear the stats when the script is updated
		this.offlineRunningTime  	= 0.01;	//Seconds
		this.offlineMoneyMade 		= 0;
		this.onlineRunningTime 		= 0.01;	//Seconds
		this.onlineMoneyMade 		= 0;
		this.lastUpdate				= 0;
        
        this.logs = [];
	}
}

Script.prototype.reset = function() {
    this.offlineRunningTime  	= 0.01;	//Seconds
	this.offlineMoneyMade 		= 0;
	this.offlineExpGained 		= 0;
	this.onlineRunningTime 		= 0.01;	//Seconds
	this.onlineMoneyMade 		= 0;
	this.onlineExpGained 		= 0;
    this.logs = [];
}

//Updates how much RAM the script uses when it is running.
Script.prototype.updateRamUsage = function() {
    var baseRam = 1;    //Each script requires 1GB to run regardless
    var codeCopy = this.code.repeat(1);
    codeCopy = codeCopy.replace(/\s/g,''); //Remove all whitespace
    
    var whileCount = numOccurrences(codeCopy, "while(");
    var forCount = numOccurrences(codeCopy, "for(");
    var ifCount = numOccurrences(codeCopy, "if(");
    var hackCount = numOccurrences(codeCopy, "hack(");
    var growCount = numOccurrences(codeCopy, "grow(");
    var nukeCount = numOccurrences(codeCopy, "nuke(");
    var brutesshCount = numOccurrences(codeCopy, "brutessh(");
    var ftpcrackCount = numOccurrences(codeCopy, "ftpcrack(");
    var relaysmtpCount = numOccurrences(codeCopy, "relaysmtp(");
    var httpwormCount = numOccurrences(codeCopy, "httpworm(");
    var sqlinjectCount = numOccurrences(codeCopy, "sqlinject(");
    var runCount = numOccurrences(codeCopy, "run(");
    var scpCount = numOccurrences(codeCopy, "scp(");
    var hasRootAccessCount = numOccurrences(codeCopy, "hasRootAccess(");
    var getHostnameCount = numOccurrences(codeCopy, "getHostname(");
    var getHackingLevelCount = numOccurrences(codeCopy, "getHackingLevel(");
    var getServerMoneyAvailableCount = numOccurrences(codeCopy, "getServerMoneyAvailable(");
    var numOperators = numNetscriptOperators(codeCopy);
    var purchaseHacknetCount = numOccurrences(codeCopy, "purchaseHacknetNode(");
    var hacknetnodesArrayCount = numOccurrences(codeCopy, "hacknetnodes[");
    var hnUpgLevelCount = numOccurrences(codeCopy, ".upgradeLevel(");
    var hnUpgRamCount = numOccurrences(codeCopy, ".upgradeRam()");
    var hnUpgCoreCount = numOccurrences(codeCopy, ".upgradeCore()");
    
    this.ramUsage =  baseRam + 
                    ((whileCount * CONSTANTS.ScriptWhileRamCost) + 
                    (forCount * CONSTANTS.ScriptForRamCost) + 
                    (ifCount * CONSTANTS.ScriptIfRamCost) + 
                    (hackCount * CONSTANTS.ScriptHackRamCost) + 
                    (growCount * CONSTANTS.ScriptGrowRamCost) + 
                    (nukeCount * CONSTANTS.ScriptNukeRamCost) + 
                    (brutesshCount * CONSTANTS.ScriptBrutesshRamCost) + 
                    (ftpcrackCount * CONSTANTS.ScriptFtpcrackRamCost) + 
                    (relaysmtpCount * CONSTANTS.ScriptRelaysmtpRamCost) + 
                    (httpwormCount * CONSTANTS.ScriptHttpwormRamCost) + 
                    (sqlinjectCount * CONSTANTS.ScriptSqlinjectRamCost) + 
                    (runCount * CONSTANTS.ScriptRunRamCost) + 
                    (scpCount * CONSTANTS.ScriptScpRamCost) + 
                    (hasRootAccessCount * CONSTANTS.ScriptHasRootAccessRamCost) + 
                    (getHostnameCount * CONSTANTS.ScriptGetHostnameRamCost) +
                    (getHackingLevelCount * CONSTANTS.ScriptGetHackingLevelRamCost) + 
                    (getServerMoneyAvailableCount * CONSTANTS.ScriptGetServerMoneyRamCost) + 
                    (numOperators * CONSTANTS.ScriptOperatorRamCost) +
                    (purchaseHacknetCount * CONSTANTS.ScriptPurchaseHacknetRamCost) + 
                    (hacknetnodesArrayCount * CONSTANTS.ScriptHacknetNodesRamCost) +
                    (hnUpgLevelCount * CONSTANTS.ScriptHNUpgLevelRamCost) + 
                    (hnUpgRamCount * CONSTANTS.ScriptHNUpgRamRamCost) +
                    (hnUpgCoreCount * CONSTANTS.ScriptHNUpgCoreRamCost));
    console.log("ram usage: " + this.ramUsage);
    if (isNaN(this.ramUsage)) {
        dialogBoxCreate("ERROR in calculating ram usage. This is a bug, please report to game develoepr");
    }
}

Script.prototype.log = function(txt) {
    if (this.logs.length > CONSTANTS.MaxLogCapacity) {
        //Delete first element and add new log entry to the end.
        //TODO Eventually it might be better to replace this with circular array
        //to improve performance
        this.logs.shift();
    }
    this.logs.push(txt);
}

Script.prototype.displayLog = function() {
    for (var i = 0; i < this.logs.length; ++i) {
        post(this.logs[i]);
    }
}

Script.prototype.toJSON = function() {
    return Generic_toJSON("Script", this);
}


Script.fromJSON = function(value) {
    return Generic_fromJSON(Script, value.data);
}

Reviver.constructors.Script = Script;


//Called when the game is loaded. Loads all running scripts (from all servers)
//into worker scripts so that they will start running
loadAllRunningScripts = function() {
	var count = 0;
    var total = 0;
	for (var property in AllServers) {
		if (AllServers.hasOwnProperty(property)) {
			var server = AllServers[property];
			
			//Reset each server's RAM usage to 0
			server.ramUsed = 0;
			
			for (var j = 0; j < server.runningScripts.length; ++j) {
				count++;
				//runningScripts array contains only names, so find the actual script object
				var script = server.getScript(server.runningScripts[j]);
				if (script == null) {continue;}
				addWorkerScript(script, server);
				
				//Offline production
				total += scriptCalculateOfflineProduction(script);
			}
		}
	}
    return total;
	console.log("Loaded " + count.toString() + " running scripts");
}

scriptCalculateOfflineProduction = function(script) {
	//The Player object stores the last update time from when we were online
	var thisUpdate = new Date().getTime();
	var lastUpdate = Player.lastUpdate;
	var timePassed = (thisUpdate - lastUpdate) / 1000;	//Seconds
	console.log("Offline for " + timePassed + " seconds");
	
	//Calculate the "confidence" rating of the script's true production. This is based
	//entirely off of time. We will arbitrarily say that if a script has been running for
	//4 hours (14400 sec) then we are completely confident in its ability
	var confidence = (script.onlineRunningTime) / 14400;
	if (confidence >= 1) {confidence = 1;}
	console.log("onlineRunningTime: " + script.onlineRunningTime);
	console.log("Confidence: " + confidence);
    
    var totalOfflineProduction = 0;
    for (var ip in script.moneyStolenMap) {
        if (script.moneyStolenMap.hasOwnProperty(ip)) {
            if (script.moneyStolenMap[ip] == 0 || script.moneyStolenMap[ip] == null) {continue;}
            var serv = AllServers[ip];
            if (serv == null) {continue;}
            var production = 0.5 * script.moneyStolenMap[ip] / script.onlineRunningTime * timePassed;
            production *= confidence;
            if (production > serv.moneyAvailable) {
                production = serv.moneyAvailable;
            }
            totalOfflineProduction += production;
            Player.gainMoney(production); 
            console.log(script.filename + " generated $" + production + " while offline by hacking " + serv.hostname);
            serv.moneyAvailable -= production;
            if (serv.moneyAvailable < 0) {serv.moneyAvailable = 0;}
        }
    }

	//A script's offline production will always be at most half of its online production.	
	var expGain = (1/2) * (script.onlineExpGained / script.onlineRunningTime) * timePassed;
	expGain *= confidence;
	
	Player.gainHackingExp(expGain);
	
	//Update script stats
	script.offlineMoneyMade += totalOfflineProduction;
	script.offlineRunningTime += timePassed;
	script.offlineExpGained += expGain;
    return totalOfflineProduction;
	//DEBUG
	var serverName = AllServers[script.server].hostname;
	console.log(script.filename + " from server " + serverName + " generated $" + totalOfflineProduction + " TOTAL while offline");
}

//Creates a function that creates a map/dictionary with the IP of each existing server as
//a key, and 0 as the value. This is used to keep track of how much money a script
//hacks from that server
function AllServersToMoneyMap() {
    for (var ip in AllServers) {
        if (AllServers.hasOwnProperty(ip)) {
            this[ip] = 0;
        }
    }
}

AllServersToMoneyMap.prototype.printConsole = function() {
    for (var ip in this) {
        if (this.hasOwnProperty(ip)) {
            var serv = AllServers[ip];
            if (serv == null) {
                console.log("Warning null server encountered with ip: " + ip);
                continue;
            }
        }
    }
}