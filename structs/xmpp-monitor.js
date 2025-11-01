const log = require("./log.js");

class XMPPMonitor {
    static logConnectionStatus() {
        if (!global.Clients) {
            log.xmpp("No XMPP clients array found");
            return;
        }

        const clientCount = global.Clients.length;
        log.xmpp(`Currently ${clientCount} XMPP clients connected`);
        
        if (clientCount > 0) {
            log.xmpp("Connected clients:");
            global.Clients.forEach((client, index) => {
                log.xmpp(`  ${index + 1}. ${client.displayName} (${client.accountId})`);
            });
        }
    }

    static getOnlineStatus() {
        if (!global.Clients) return { online: 0, clients: [] };

        return {
            online: global.Clients.length,
            clients: global.Clients.map(client => ({
                displayName: client.displayName,
                accountId: client.accountId,
                lastPresenceUpdate: client.lastPresenceUpdate
            }))
        };
    }

    static startMonitoring(intervalMinutes = 5) {
        log.xmpp(`Starting XMPP monitoring every ${intervalMinutes} minutes`);
        
        setInterval(() => {
            this.logConnectionStatus();
        }, intervalMinutes * 60 * 1000);
    }
}

module.exports = XMPPMonitor;