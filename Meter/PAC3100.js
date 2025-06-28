const ModbusRTU = require('modbus-serial');

class PAC3100 {
    constructor(com, id = 1, parameter, disconnect, baudRate = 9600) {
        this.com = com;
        this.id = id;
        this.client = new ModbusRTU();
        this.isConnected = false;
        this.parameter = parameter;
        this.baudRate = baudRate;
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
            let f = sumFloatFromWord(data.slice(38, 40));
            let cosphi = sumFloatFromWord(data.slice(52, 54));

            //Chỉ số điện đã sử dụng
            const dataT = await withTimeout(
                this.client.readHoldingRegisters(801, 4),
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
        await this.readHoldingRegisters(oldValue, sendData);
    }
}

module.exports = { PAC3100 };
