const fs = require('fs');
const moment = require('moment');
const path = require('path');
const logFilePath = path.join(__dirname, `log${moment().format('YYYYMMDD')}.txt`);

//Kiểm tra tồn tại file chưa
if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, ''); // Tạo file mới nếu chưa tồn tại
}

function logError(...args) {
    const redText = '\x1b[31m'; // Màu đỏ ANSI
    const resetColor = '\x1b[0m'; // Reset về mặc định
    console.log(redText, ...args, resetColor);

    //Ghi log vào file
    const logMessage = `${new Date().toLocaleString()} [ERROR] - ${args.join('; ')}\n`;

    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            // console.error(`Ghi log ${logMessage} thất bại:`, err);
        }
    });
}

function logSuccess(...args) {
    const greenText = '\x1b[32m'; // Màu xanh ANSI
    const resetColor = '\x1b[0m'; // Reset về mặc định
    console.log(greenText, ...args, resetColor);

    //Ghi log vào file
    const logMessage = `${new Date().toLocaleString()} -[SUCCESS] ${args.join('; ')}\n`;
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            // console.error(`Ghi log ${logMessage} thất bại:`, err);
        }
    });
}

module.exports = {logError, logSuccess};
