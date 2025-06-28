const ModbusRTU = require('modbus-serial');

class MFM384 {
    constructor(com, id = 1, parameter, disconnect, baudRate = 9600) {
        this.com = com;
        this.baudRate = baudRate;
        this.id = id;
        this.client = new ModbusRTU();
        this.isConnected = false;
        this.parameter = parameter;
        this.disconnect = disconnect; //Biến để kiểm tra mất kết nối
    }

    async connect(oldValue, sendData) {
        try {
            if (!this.isConnected) {
                await this.client.connectRTUBuffered(this.com, {
                    baudRate: this.baudRate,
                });
                this.client.setID(this.id);
                this.isConnected = true;
                sendData[this.disconnect] = 0; // Gửi trạng thái kết nối
                logSuccess(
                    `✅ Kết nối thành công: ${this.com}, ID: ${this.id}`
                );
            }
        } catch (error) {
            logError(`❌ Lỗi kết nối ${this.com}:`, error.message);
            this.isConnected = false;
            if (!oldValue[this.disconnect]) {
                sendData[this.disconnect] = 1; // Gửi trạng thái mất kết nối
            }
        }
    }

    async readInputRegisters(oldValue, sendData) {
        //autoSend khi từ 23h59p=>24h
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const autoSend = currentTime >= 23 * 60 + 59 && currentTime <= 24 * 60; //23h59->24h
        console.log(
            `autoSend: ${
                currentTime >= 13 * 60 + 1 && currentTime <= 13 * 60 + 2
            }`
        );
        const sendToServer = initSendToServer(oldValue, sendData, autoSend);
        try {
            await this.connect(oldValue, sendData); // Đảm bảo đã kết nối trước khi đọc
            /*******ĐỌC DỮ LIỆU********/
            let data = await withTimeout(
                this.client.readInputRegisters(1, 60),
                3000
            );
            data = data.data;
            // console.log(data);

            let u = sumFloatFromWord(data.slice(6, 8));
            let i = sumFloatFromWord(data.slice(22, 24));
            let p = sumFloatFromWord(data.slice(42, 44));
            let f = sumFloatFromWord(data.slice(56, 58));
            let cosphi = sumFloatFromWord(data.slice(54, 56));
            let t = sumFloatFromWord(data.slice(58, 60));

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
            logError(`⚠️ Lỗi đọc dữ liệu từ ${this.com}:`, error.message);
            this.isConnected = false; // Nếu lỗi, đánh dấu mất kết nối

            if (this.client.isOpen) {
                await this.client.close();
                logSuccess('Đóng kết nối' + this.com);
            }
            this.client = new ModbusRTU();
        }
    }

    async readData(oldValue, sendData) {
        await this.readInputRegisters(oldValue, sendData);
    }
}

module.exports = { MFM384 };
