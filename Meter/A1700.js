const ModbusRTU = require('modbus-serial');

class A1700 {
    constructor(
        com,
        parameter,
        scale,
        type = 4,
        disconnect = '',
        id = 1,
        baudRate = 9600
    ) {
        this.com = com;
        this.baudRate = baudRate;
        this.id = id;
        this.client = new ModbusRTU();
        this.isConnected = false;
        this.parameter = parameter;
        this.scale = scale;
        this.type = type;
        this.disconnect = disconnect; // Thêm thuộc tính disconnect để lưu tên biến mất kết nối
    }

    async connect(oldValue, sendData) {
        try {
            if (!this.isConnected) {
                await this.client.connectRTUBuffered(this.com, {
                    baudRate: this.baudRate,
                });
                this.client.setID(this.id);
                this.isConnected = true;
                logSuccess(
                    `✅ Kết nối thành công: ${this.com}, ID: ${this.id}`
                );
                sendData[this.disconnect] = 0; // Gửi trạng thái kết nối
            }
        } catch (error) {
            if (!oldValue[this.disconnect]) {
                sendData[this.disconnect] = 1; // Gửi trạng thái mất kết nối
            }
            logError(`❌ Lỗi kết nối ${this.com}:`, error.message);
            this.isConnected = false;
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
                this.client.readHoldingRegisters(0, 90),
                5000
            );
            data = data.data;

            let u = sumLongFromWord(data.slice(32, 38)) / (3 * 10); //Điện áp dây trung bình
            let i = (sumLongFromWord(data.slice(38, 42)) * this.scale) / 100; //Tổng dòng 3 pha
            let p = (sumLongFromWord(data.slice(44, 46)) * this.scale) / 100; //Tổng công suất 3 pha
            let f = sumLongFromWord(data.slice(84, 86)) / 10; //tần số
            let cosphi = sumLongFromWord(data.slice(76, 78)) / 1000; //cos phi
            let t = (sumLongFromWord(data.slice(0, 2)) * this.scale) / 10; //Chỉ số điện đã sử dụng
            // /*******CHECK XEM CÁC THÔNG SỐ THAY DỔI********/
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
                this.client.close(); // Đóng kết nối nếu có lỗi
                logSuccess(`Đóng kết nối ${this.com} do lỗi đọc dữ liệu`);
            }
            this.client = new ModbusRTU(); // Tạo một client mới
        }
    }

    async readInputRegisters(oldValue, sendData) {
        //autoSend khi từ 23h59p=>24hs
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const autoSend = currentTime >= 23 * 60 + 59 && currentTime <= 24 * 60; //23h59->24h
        const sendToServer = initSendToServer(oldValue, sendData, autoSend);
        try {
            await this.connect(oldValue, sendData); // Đảm bảo đã kết nối trước khi đọc

            /*******ĐỌC DỮ LIỆU********/
            let data = await withTimeout(
                this.client.readInputRegisters(0, 70),
                5000
            );
            data = data.data;

            let u = sumFloatFromWord(data.slice(6, 8)); //Điện áp
            let i = sumFloatFromWord(data.slice(16, 22)); //Dòng điện
            let p = sumFloatFromWord(data.slice(44, 46)) * this.scale; //Công suất
            let f = sumFloatFromWord(data.slice(56, 58)); //Tần số
            let cosphi = sumFloatFromWord(data.slice(54, 56)); //Hệ số công suất
            let t = sumFloatFromWord(data.slice(58, 60)) * this.scale; //Chỉ số điện đã sử dụng

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
                this.client.close(); // Đóng kết nối nếu có lỗi
                logSuccess(`Đóng kết nối ${this.com} do lỗi đọc dữ liệu`);
            }
            this.client = new ModbusRTU(); // Tạo một client mới
        }
    }

    async readData(oldValue, sendData) {
        if (this.type === 4) {
            await this.readHoldingRegisters(oldValue, sendData);
        } else if (this.type === 3) {
            await this.readInputRegisters(oldValue, sendData);
        } else {
            logError(`❌ Loại Modbus không hợp lệ: ${this.type}`);
        }
    }
}

module.exports = { A1700 };
