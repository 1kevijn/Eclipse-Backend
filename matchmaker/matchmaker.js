const functions = require("../structs/functions.js");

module.exports = async (ws) => {
    let isConnected = true;
    let hasStarted = false;
    
    // Error handling für WebSocket
    ws.on('error', (error) => {
        console.log('Matchmaker WebSocket error:', error);
        isConnected = false;
    });
    
    ws.on('close', (code, reason) => {
        console.log(`Matchmaker WebSocket closed: ${code} - ${reason}`);
        isConnected = false;
    });
    
    // Hilfsfunktion um zu prüfen ob Verbindung noch aktiv ist
    function checkConnection() {
        return isConnected && ws.readyState === ws.OPEN;
    }
    
    // Sichere send-Funktion
    function safeSend(data) {
        if (checkConnection()) {
            try {
                ws.send(data);
                return true;
            } catch (error) {
                console.log('Error sending matchmaker data:', error);
                isConnected = false;
                return false;
            }
        }
        return false;
    }
    
    // Verhindere mehrfache Ausführung
    if (hasStarted) return;
    hasStarted = true;
    
    // Heartbeat um Verbindung am Leben zu halten
    const heartbeat = setInterval(() => {
        if (checkConnection()) {
            try {
                ws.ping();
            } catch (error) {
                console.log('Heartbeat failed:', error);
                clearInterval(heartbeat);
                isConnected = false;
            }
        } else {
            clearInterval(heartbeat);
        }
    }, 30000); // Alle 30 Sekunden
    
    // Cleanup bei Verbindungsende
    ws.on('close', () => {
        clearInterval(heartbeat);
    });
    
    // Pong-Handler
    ws.on('pong', () => {
        // Verbindung ist noch aktiv
    });
    
    // create hashes
    const ticketId = functions.MakeID().replace(/-/ig, "");
    const matchId = functions.MakeID().replace(/-/ig, "");
    const sessionId = functions.MakeID().replace(/-/ig, "");
    
    try {
        console.log('Starting matchmaker process...');
        
        if (!checkConnection()) return;
        Connecting();
        await functions.sleep(500);
        
        if (!checkConnection()) return;
        Waiting();
        await functions.sleep(800);
        
        if (!checkConnection()) return;
        Queued();
        await functions.sleep(2000);
        
        if (!checkConnection()) return;
        SessionAssignment();
        await functions.sleep(1000);
        
        if (!checkConnection()) return;
        Join();
        
        console.log('Matchmaker process completed successfully');
        
        // Halte die Verbindung für weitere 30 Sekunden offen
        setTimeout(() => {
            if (checkConnection()) {
                console.log('Closing matchmaker connection after timeout');
                ws.close(1000, 'Matchmaker completed');
            }
        }, 30000);
        
    } catch (error) {
        console.log('Matchmaker process error:', error);
        if (checkConnection()) {
            ws.close(1000, 'Matchmaker error');
        }
    }

    function Connecting() {
        return safeSend(JSON.stringify({
            "payload": {
                "state": "Connecting"
            },
            "name": "StatusUpdate"
        }));
    }

    function Waiting() {
        return safeSend(JSON.stringify({
            "payload": {
                "totalPlayers": 1,
                "connectedPlayers": 1,
                "state": "Waiting"
            },
            "name": "StatusUpdate"
        }));
    }

    function Queued() {
        return safeSend(JSON.stringify({
            "payload": {
                "ticketId": ticketId,
                "queuedPlayers": 0,
                "estimatedWaitSec": 0,
                "status": {},
                "state": "Queued"
            },
            "name": "StatusUpdate"
        }));
    }

    function SessionAssignment() {
        return safeSend(JSON.stringify({
            "payload": {
                "matchId": matchId,
                "state": "SessionAssignment"
            },
            "name": "StatusUpdate"
        }));
    }

    function Join() {
        return safeSend(JSON.stringify({
            "payload": {
                "matchId": matchId,
                "sessionId": sessionId,
                "joinDelaySec": 1
            },
            "name": "Play"
        }));
    }
};
