import jwt from "jsonwebtoken";

export const generateToken = (user) => {
    return jwt.sign({ sub: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    })
}