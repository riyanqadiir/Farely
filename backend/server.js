require("dotenv").config();
const express = require("express");
const app = express();
const connectToDb = require("./config/db");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");

// DB
connectToDb();

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    cors({
        origin: "*",
        credentials: true,
        exposedHeaders: ["authorization"],
    })
);

// Health check
app.get("/", (req, res) => {
    res.send("API running");
});

// Routes
app.use("/auth", authRoutes);

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`);
});
