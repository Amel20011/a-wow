const qrcode = require('qrcode-terminal');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

// Fungsi utama untuk menjalankan bot
async function connectToWhatsApp() {
    console.log('Mengambil versi terbaru Baileys...');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Menggunakan Baileys versi ${version}, terbaru: ${isLatest}`);

    // Menggunakan state autentikasi multi-file untuk menyimpan sesi
    // Folder 'auth_info_baileys' akan otomatis dibuat
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false // Kita akan menampilkan QR secara manual
    });

    // Menampilkan QR Code di console/terminal jika belum ada sesi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('Scan QR Code ini dengan WhatsApp Anda:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Koneksi terputus karena ', lastDisconnect?.error, ', reconnect lagi ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Koneksi berhasil terbuka! Bot siap digunakan.');
        }
    });

    // Menyimpan kredensial setelah autentikasi berhasil
    sock.ev.on('creds.update', saveCreds);

    // Mendengarkan pesan masuk
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message) return; // Pesan kosong
        if (msg.key.fromMe) return; // Abaikan pesan dari bot itu sendiri

        // Mendapatkan ID pengirim dan isi pesan
        const remoteJid = msg.key.remoteJid;
        const messageType = Object.keys(msg.message)[0];
        
        // Mengambil teks dari pesan (baik pesan teks biasa atau extended)
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        console.log(`Menerima pesan: "${textMessage}" dari ${remoteJid}`);

        // Jika user mengetik "menu", kirimkan menu dengan button
        if (textMessage.toLowerCase() === 'menu') {
            await sendMenu(sock, remoteJid);
        }

        // Mendeteksi jika user menekan button
        if (messageType === 'interactiveResponseMessage') {
            const buttonId = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id;
            console.log(`User menekan button dengan ID: ${buttonId}`);
            await handleButtonResponse(sock, remoteJid, buttonId);
        }
    });
}

// Fungsi untuk mengirim menu dengan 10 button (Kompatibel iOS)
async function sendMenu(sock, jid) {
    const buttons = [
        { id: 'id_1', display_text: 'Menu 1: Info Bot' },
        { id: 'id_2', display_text: 'Menu 2: Owner' },
        { id: 'id_3', display_text: 'Menu 3: Donasi' },
        { id: 'id_4', display_text: 'Menu 4: Rules' },
        { id: 'id_5', display_text: 'Menu 5: Test Fitur A' },
        { id: 'id_6', display_text: 'Menu 6: Test Fitur B' },
        { id: 'id_7', display_text: 'Menu 7: Test Fitur C' },
        { id: 'id_8', display_text: 'Menu 8: Test Fitur D' },
        { id: 'id_9', display_text: 'Menu 9: Test Fitur E' },
        { id: 'id_10', display_text: 'Menu 10: Tutup Menu' }
    ];

    const messagePayload = {
        interactiveMessage: {
            header: {
                hasMediaAttachment: false,
                text: "🤖 Bot Menu Test"
            },
            body: {
                text: "Halo! Selamat datang di menu bot. Silakan pilih salah satu opsi di bawah ini:"
            },
            footer: {
                text: "© 2024 Test Bot"
            },
            nativeFlowMessage: {
                buttons: buttons.map(btn => ({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: btn.display_text,
                        id: btn.id
                    })
                }))
            }
        }
    };

    await sock.sendMessage(jid, {
        buttons: messagePayload,
        headerType: 1
    });
    console.log(`Menu dengan 10 button telah dikirim ke ${jid}`);
}

// Fungsi untuk menangani respons dari button yang ditekan
async function handleButtonResponse(sock, jid, buttonId) {
    let responseText = '';

    switch (buttonId) {
        case 'id_1':
            responseText = 'Ini adalah informasi tentang bot ini. Bot dibuat untuk tujuan testing.';
            break;
        case 'id_2':
            responseText = 'Owner bot adalah [Nama Anda]. Hubungi jika ada yang penting.';
            break;
        case 'id_3':
            responseText = 'Terima kasih atas niat berdonasinya. Silakan hubungi owner untuk info lebih lanjut.';
            break;
        case 'id_4':
            responseText = 'Rules:\n1. Jangan spam bot.\n2. Jangan gunakan untuk hal-hal negatif.';
            break;
        case 'id_5':
            responseText = 'Fitur A sedang dalam tahap pengembangan.';
            break;
        case 'id_6':
            responseText = 'Fitur B sedang dalam tahap pengembangan.';
            break;
        case 'id_7':
            responseText = 'Fitur C sedang dalam tahap pengembangan.';
            break;
        case 'id_8':
            responseText = 'Fitur D sedang dalam tahap pengembangan.';
            break;
        case 'id_9':
            responseText = 'Fitur E sedang dalam tahap pengembangan.';
            break;
        case 'id_10':
            responseText = 'Menu ditutup. Ketik "menu" lagi untuk membuka.';
            break;
        default:
            responseText = 'Pilihan tidak valid.';
            break;
    }

    await sock.sendMessage(jid, { text: responseText });
    console.log(`Respons untuk button ${buttonId} telah dikirim ke ${jid}`);
}

// Jalankan bot
connectToWhatsApp().catch(err => {
    console.error("Error saat menjalankan bot:", err);
});
