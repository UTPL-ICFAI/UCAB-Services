const io = require("socket.io-client");
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "ucab_secret_2026";
const Captain = require("./models/Captain");

(async () => {
    const cap = await Captain.findOne({});
    if (!cap) { console.log("No captain in DB"); process.exit(1); }

    const token = jwt.sign({ id: cap._id, role: "captain" }, SECRET, { expiresIn: "1h" });
    console.log("Testing with captain:", cap.name, "| vehicle:", cap.vehicle && cap.vehicle.type);

    // 1. Captain goes online
    const capSock = io("http://localhost:5000");
    capSock.on("connect", () => {
        console.log("[captain] socket connected:", capSock.id);
        capSock.emit("captain online", { token });
    });
    capSock.on("captain profile", (p) => console.log("[captain] got profile:", p.name));
    capSock.on("new ride", (r) => console.log("[captain] *** GOT NEW RIDE ***", JSON.stringify(r)));

    // 2. After 2 sec, user books a ride with same vehicle type
    setTimeout(() => {
        const userSock = io("http://localhost:5000");
        userSock.on("connect", () => {
            console.log("[user] socket connected:", userSock.id);
            const rideType = cap.vehicle && cap.vehicle.type ? cap.vehicle.type : "go";
            console.log("[user] booking rideType:", rideType);
            userSock.emit("new ride request", {
                pickup: { lat: 12.9, lng: 77.6, address: "MG Road, Bangalore" },
                dropoff: { lat: 12.95, lng: 77.65, address: "Indiranagar, Bangalore" },
                fare: 150,
                rideType
            });
        });
    }, 2000);

    setTimeout(() => { console.log("Done"); process.exit(0); }, 8000);
});
