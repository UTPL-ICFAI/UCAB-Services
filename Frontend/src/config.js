/**
 * Frontend Configuration
 * 
 * In production (Vercel), set REACT_APP_BACKEND_URL to your Render HTTPS URL.
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://ucab-services.onrender.com";

export default BACKEND_URL;