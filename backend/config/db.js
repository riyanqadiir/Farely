const mongoose = require("mongoose");

const connectToDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/Farely");
        console.log("Database Connected Successfully!");
    } catch (error) {
        console.error("Database connection error:", error);
        process.exit(1);
    }
};

module.exports = connectToDb;
