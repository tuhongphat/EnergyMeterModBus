const ModbusRTU = require('modbus-serial');
const { logSuccess, logError } = require('./common');

class PAC3200 {
    constructor(ip, port, id = 1, parameter, disconnect) {
        this.ip = ip;
        this.port = port;
        this.id = id;
        this.client = new ModbusRTU();
        this.isConnected = false;
        this.parameter = parameter;
        this.disconnect = disconnect; //Biến để kiểm tra mất kết nối
    }

    async connect(oldValue, sendData) {
        try {
            if (!this.isConnected) {
                await this.client.connectTCP(this.ip, { port: this.port });
                this.client.setID(this.id);
                this.isConnected = true;
                sendData[this.disconnect] = 0; // Gửi trạng thái kết nối
                logSuccess(
                    `✅ Kết nối thành công: ${this.ip},port: ${this.port}; ID: ${this.id}`
                );
            }
        } catch (error) {
            logError(`❌ Lỗi kết nối ${this.ip}:`, error.message);
            this.isConnected = false;
            if (!oldValue[this.disconnect]) {
                sendData[this.disconnect] = 1; // Gửi trạng thái mất kết nối
            }
        }
    }

    async readHoldingRegisters(oldValue, sendData) {
        //autoSend khi từ 23h59p=>24h
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const autoSend = currentTime >= 23 * 60 + 59 && currentTime <= 24 * 60; //23h59->24h
        const sendToServer = initSendToServer(oldValue, sendData, autoSend);
        try {
            await this.connect(oldValue, sendData); // Đảm bảo đã kết nối trước khi đọc
            /*******ĐỌC DỮ LIỆU********/
            let data = await withTimeout(
                this.client.readHoldingRegisters(1, 80),
                3000
            );
            data = data.data;

            let u = sumFloatFromWord(data.slice(0, 6)) / 3;
            let i = sumFloatFromWord(data.slice(12, 18)) / 3;
            let p = sumFloatFromWord(data.slice(24, 30)) / (3 * 1000);
            let f = sumFloatFromWord(data.slice(54, 56));
            let cosphi = sumFloatFromWord(data.slice(68, 70));

            //Chỉ số điện đã sử dụng
            const dataT = await withTimeout(
                this.client.readHoldingRegisters(801, 8),
                3000
            );
            let t = sumDoubleFromWord(dataT.data) / 1000;

            // console.log({u, i, p, f, cosphi, t});
            /*******CHECK XEM CÁC THÔNG SỐ THAY DỔI********/
            sendToServer(
                u,
                this.parameter.Upha.PLCName,
                this.parameter.Upha.dif
            ); //Điện áp
            sendToServer(
                i,
                this.parameter.Ipha.PLCName,
                this.parameter.Ipha.dif
            ); //Dòng điện
            sendToServer(p, this.parameter.P.PLCName, this.parameter.P.dif); //Công suất
            sendToServer(f, this.parameter.f.PLCName, this.parameter.f.dif); //Tần số
            sendToServer(
                cosphi,
                this.parameter.cosphi.PLCName,
                this.parameter.cosphi.dif
            ); //Hệ số công suất
            sendToServer(t, this.parameter.T.PLCName, this.parameter.T.dif); //Chỉ số điện đã sử dụng
        } catch (error) {
            logError(
                `⚠️ Lỗi đọc dữ liệu từ ${this.ip}: ${this.port}`,
                error.message
            );
            this.isConnected = false; // Nếu lỗi, đánh dấu mất kết nối

            if (this.client.isOpen) {
                await this.client.close();
                logSuccess('Đóng kết nối' + this.ip + ': ' + this.port);
            }
            this.client = new ModbusRTU();
        }
    }

    async readData(oldValue, sendData) {
        await this.readHoldingRegisters(oldValue, sendData);
    }
}

module.exports = { PAC3200 };
