// Auto-detects the backend host — works on localhost AND on LAN (friends' laptops)
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || `http://${window.location.hostname}:5000`;
export default BACKEND_URL;