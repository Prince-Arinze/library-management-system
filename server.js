import dotenv from "dotenv"
import app from "./src/app.js";
import { connectDB } from "./src/config/dbConnection.js";

dotenv.config()

const startServer = async () => {
    try {
        if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required'); 

        await connectDB();

        app.listen(process.env.PORT || 5000, () => {
            console.log(`Server is running on port ${process.env.PORT || 5000}`);
        });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
startServer();
