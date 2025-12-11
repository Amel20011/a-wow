const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.authState = null;
        this.menuOptions = [
            { id: '1', title: '📋 Informasi Bot', desc: 'Menampilkan informasi tentang bot' },
            { id: '2', title: '🕐 Waktu Server', desc: 'Menampilkan waktu server saat ini' },
            { id: '3', title: '📊 Status Server', desc: 'Menampilkan status server bot' },
            { id: '4', title: '👤 Profil Pengguna', desc: 'Menampilkan profil Anda' },
            { id: '5', title: '📁 File Contoh', desc: 'Mendapatkan file contoh' },
            { id: '6', title: '🔧 Pengaturan', desc: 'Menu pengaturan bot' },
            { id: '7', title: '📞 Kontak', desc: 'Informasi kontak admin' },
            { id: '8', title: '❓ Bantuan', desc: 'Menampilkan panduan penggunaan' },
            { id: '9', title: '🔄 Restart', desc: 'Restart bot (admin only)' },
            { id: '10', title: '🚪 Keluar', desc: 'Keluar dari menu' }
        ];
    }

    // Fungsi untuk inisialisasi koneksi
    async initialize() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');
            this.authState = state;
            
            const { version } = await fetchLatestBaileysVersion();
            
            this.sock = makeWASocket({
                version,
                printQRInTerminal: true,
                logger: pino({ level: 'silent' }),
                browser: Browsers.ubuntu('Chrome'),
                auth: this.authState,
                getMessage: async (key) => {
                    return {
                        conversation: 'Hello!'
                    };
                }
            });
            
            // Handle kredensial update
            this.sock.ev.on('creds.update', saveCreds);
            
            // Handle koneksi
            this.sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
                    
                    if (shouldReconnect) {
                        this.initialize();
                    }
                } else if (connection === 'open') {
                    console.log('✅ Bot connected successfully!');
                    console.log('🤖 Bot is ready to receive messages');
                }
            });
            
            // Handle pesan masuk
            this.sock.ev.on('messages.upsert', async (m) => {
                const message = m.messages[0];
                if (!message.key.fromMe && m.type === 'notify') {
                    await this.handleMessage(message);
                }
            });
            
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    // Fungsi untuk mengirim pesan dengan button
    async sendButtonMessage(jid, text, buttons, footer = null) {
        try {
            const buttonMessage = {
                text: text,
                footer: footer || '© 2024 WhatsApp Bot - Multi Device',
                buttons: buttons,
                headerType: 1
            };
            
            await this.sock.sendMessage(jid, buttonMessage);
        } catch (error) {
            console.error('Error sending button message:', error);
        }
    }

    // Fungsi untuk mengirim list message (alternative untuk banyak opsi)
    async sendListMessage(jid, text, buttonText, sections, title = null) {
        try {
            const listMessage = {
                text: text,
                footer: '© 2024 WhatsApp Bot - Multi Device',
                title: title || 'Menu Utama',
                buttonText: buttonText,
                sections: sections
            };
            
            await this.sock.sendMessage(jid, listMessage);
        } catch (error) {
            console.error('Error sending list message:', error);
        }
    }

    // Fungsi untuk handle pesan masuk
    async handleMessage(message) {
        try {
            const jid = message.key.remoteJid;
            const user = message.key.participant || jid;
            const text = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        message.message?.buttonsResponseMessage?.selectedButtonId ||
                        message.message?.listResponseMessage?.title ||
                        '';
            
            // Log pesan
            console.log(`📩 Message from ${user}: ${text}`);
            
            // Cek jika pesan adalah perintah menu
            if (text.toLowerCase() === '!menu' || 
                text.toLowerCase() === '.menu' || 
                text.toLowerCase() === '/menu' ||
                text.toLowerCase() === 'menu' ||
                text === '0' ||
                message.message?.buttonsResponseMessage?.selectedButtonId === '0') {
                
                await this.showMainMenu(jid);
                return;
            }
            
            // Handle response dari button
            if (message.message?.buttonsResponseMessage) {
                const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
                await this.handleButtonResponse(jid, buttonId, user);
                return;
            }
            
            // Handle response dari list message
            if (message.message?.listResponseMessage) {
                const selectedId = message.message.listResponseMessage.title;
                await this.handleListResponse(jid, selectedId, user);
                return;
            }
            
            // Handle pesan biasa
            switch (text.toLowerCase()) {
                case 'hi':
                case 'hello':
                case 'halo':
                    await this.sock.sendMessage(jid, { 
                        text: '👋 Hello! Ketik *menu* untuk melihat daftar perintah yang tersedia.' 
                    });
                    break;
                    
                case 'ping':
                    await this.sock.sendMessage(jid, { 
                        text: '🏓 Pong! Bot is active and running.' 
                    });
                    break;
                    
                case 'owner':
                case 'admin':
                    await this.sock.sendMessage(jid, { 
                        text: '👑 Owner Bot: @rexxhayanasi\n📧 Email: hayanasi@example.com' 
                    });
                    break;
                    
                default:
                    if (!message.key.fromMe) {
                        await this.sock.sendMessage(jid, { 
                            text: '🤖 Bot Multi-Device\n\nKetik *menu* untuk melihat daftar perintah yang tersedia.\n\nPowered by @rexxhayanasi/elaina-baileys' 
                        });
                    }
            }
            
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    // Fungsi untuk menampilkan menu utama
    async showMainMenu(jid) {
        // Membuat sections untuk list message
        const sections = [
            {
                title: "📋 MENU UTAMA",
                rows: this.menuOptions.map(option => ({
                    title: option.title,
                    rowId: option.id,
                    description: option.desc
                }))
            }
        ];
        
        // Menggunakan list message untuk iOS compatibility
        await this.sendListMessage(
            jid,
            '🤖 *BOT WHATSAPP MULTI-DEVICE*\n\nPilih salah satu menu di bawah:',
            '📱 Buka Menu',
            sections,
            'Menu Utama'
        );
    }

    // Fungsi untuk handle button response
    async handleButtonResponse(jid, buttonId, user) {
        switch (buttonId) {
            case '1':
                await this.sock.sendMessage(jid, { 
                    text: '🤖 *Informasi Bot*\n\n• Nama: WhatsApp Bot Multi-Device\n• Versi: 2.0.0\n• Library: @rexxhayanasi/elaina-baileys\n• Developer: @rexxhayanasi\n\nKetik *menu* untuk kembali ke menu utama.' 
                });
                break;
                
            case '2':
                const now = new Date();
                await this.sock.sendMessage(jid, { 
                    text: `🕐 *Waktu Server*\n\n• Tanggal: ${now.toLocaleDateString('id-ID')}\n• Waktu: ${now.toLocaleTimeString('id-ID')}\n• Zona Waktu: ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n\nKetik *menu* untuk kembali ke menu utama.` 
                });
                break;
                
            case '3':
                await this.sock.sendMessage(jid, { 
                    text: '📊 *Status Server*\n\n• Status: ✅ Online\n• Uptime: 24/7\n• Memory Usage: Normal\n• Response Time: < 1s\n\nKetik *menu* untuk kembali ke menu utama.' 
                });
                break;
                
            case '0':
                await this.showMainMenu(jid);
                break;
                
            default:
                // Untuk button yang belum diimplementasi, kirim pesan default
                await this.sock.sendMessage(jid, { 
                    text: `Fitur untuk menu ${buttonId} sedang dalam pengembangan.\n\nKetik *menu* untuk melihat menu lain yang tersedia.` 
                });
        }
    }

    // Fungsi untuk handle list response
    async handleListResponse(jid, selectedId, user) {
        const menuItem = this.menuOptions.find(item => item.id === selectedId);
        
        if (!menuItem) {
            await this.sock.sendMessage(jid, { 
                text: 'Menu tidak ditemukan. Ketik *menu* untuk melihat daftar menu.' 
            });
            return;
        }
        
        // Buat buttons untuk setiap menu item
        const buttons = [
            { buttonId: '0', buttonText: { displayText: '🏠 Menu Utama' }, type: 1 }
        ];
        
        // Kirim pesan dengan button sesuai menu yang dipilih
        await this.sendButtonMessage(
            jid,
            `*${menuItem.title}*\n\n${this.getMenuDescription(selectedId)}\n\nPilih aksi di bawah:`,
            buttons,
            `Dipilih: ${menuItem.title}`
        );
    }

    // Fungsi untuk mendapatkan deskripsi menu
    getMenuDescription(menuId) {
        switch (menuId) {
            case '1':
                return '🤖 Bot Information:\n• Name: WhatsApp Multi-Device Bot\n• Version: 2.0.0\n• Library: elaina-baileys\n• Developer: @rexxhayanasi\n• Multi-Device: ✅ Yes\n• iOS Support: ✅ Yes';
                
            case '2':
                return `🕐 Server Time:\n${new Date().toLocaleString('id-ID', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZoneName: 'short'
                })}`;
                
            case '3':
                return '📊 Server Status:\n• Status: Online ✅\n• Response: < 500ms\n• Memory: 256MB/1GB\n• CPU: 15%\n• Platform: Node.js';
                
            case '4':
                return '👤 User Profile:\n• Feature: Get user profile info\n• Status: Available\n• Note: This will display your profile information';
                
            case '5':
                return '📁 Example Files:\n• Available files:\n  1. example.txt\n  2. sample.pdf\n  3. test.jpg\n• Size limit: 16MB';
                
            case '6':
                return '🔧 Bot Settings:\n• Language: Indonesian\n• Notification: Enabled\n• Auto Reply: Enabled\n• Anti-Spam: Enabled';
                
            case '7':
                return '📞 Contact Admin:\n• Name: Hayanasi\n• Email: hayanasi@example.com\n• GitHub: @rexxhayanasi\n• Response Time: < 24 hours';
                
            case '8':
                return '❓ Help & Guide:\n• Command: !menu / .menu / menu\n• Type: 0 to return to main menu\n• Support: Button & List Message\n• iOS: Fully Supported';
                
            case '9':
                return '🔄 Restart Bot:\n• Admin Only Feature\n• Requires admin privileges\n• Will restart the bot service\n• Estimated downtime: 5 seconds';
                
            case '10':
                return '🚪 Exit Menu:\n• Closing current session\n• You can type "menu" anytime to reopen\n• Bot will still respond to other commands\n• Thank you for using!';
                
            default:
                return 'Description not available for this menu.';
        }
    }

    // Fungsi untuk mengirim pesan broadcast (opsional)
    async broadcastMessage(message) {
        const chats = await this.sock.groupFetchAllParticipating();
        
        for (const group of Object.values(chats)) {
            try {
                await this.sock.sendMessage(group.id, { text: message });
                console.log(`Message sent to group: ${group.subject}`);
            } catch (error) {
                console.error(`Failed to send to ${group.subject}:`, error);
            }
        }
    }
}

// Jalankan bot
const bot = new WhatsAppBot();

// Handle proses shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Terminating bot...');
    process.exit(0);
});

// Mulai bot
console.log('🚀 Starting WhatsApp Multi-Device Bot...');
console.log('📱 iOS Button Support: ✅ Enabled');
console.log('🔧 Library: @rexxhayanasi/elaina-baileys');
console.log('👤 Developer: @rexxhayanasi\n');

bot.initialize().catch(console.error);
