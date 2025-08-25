// Acolyte, pick thy battle-cry wisely.
export const LOGIN_PHRASES = [
    "We only roll critical hits on privacy.",
    "Authentication rites begin.",
    "Sanctifying your session with holy salts.",
    "Heretekal bots will be purged at the door.",
    "Two-factor? More like two-headed daemon.",
    "Let the death rituals begin.",
    "Hashing like a chainsword through ciphertext.",
    "No daemons beyond this gateway.",
    "Your password is your power armor. Seal it tight.",
    "Purge the cache, for it is unclean.",
    "Encrypt. Engage. Exterminate bad actors.",
    "Captcha? We prefer bullets.",
    "OAuth seals waxed and stamped.",
    "Verifying your gene-seed (email).",
    "May your cookies be HttpOnly and secure.",
    "Rate limits sharper than a power sword.",
    "Our logs worship only anon telemetry.",
    "Glory to the uptime, shame to 500s.",
    "Rogue psykers get 401 Unauthorized.",
    "We serve the Emperor of Strong Passwords.",
    "Session tokens blessed and rotated.",
    "XSS banished to the Eye of Terror.",
    "May your death be a spectacle of glory.",
    "Zero trust, maximum zeal.",
    "The Omnissiah smiles upon valid JWTs.",
    "Multi-factor prayers whispered.",
    "Firewall hotter than a plasma gun.",
    "Access granted by the Inquisition of Auth.",
    "CSRF wards etched into the sigils.",
    "Audit trails longer than a crusade."
  ];
  
  export function getRandomLoginPhrase() {
    return LOGIN_PHRASES[Math.floor(Math.random() * LOGIN_PHRASES.length)];
  }