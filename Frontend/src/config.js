// Production backend on Render. Override with REACT_APP_BACKEND_URL env var if needed.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://ucab-services.onrender.com";
export default BACKEND_URL;