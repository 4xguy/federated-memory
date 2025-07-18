import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

/**
 * Cross-platform password hashing utility that doesn't require native bindings
 * Uses PBKDF2 with SHA-256, which is built into Node.js
 */
export class CryptoHash {
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 64;
  private static readonly SALT_LENGTH = 32;
  private static readonly DIGEST = 'sha256';

  /**
   * Hash a password using PBKDF2
   * @param password - The password to hash
   * @returns The hashed password in format: salt$hash
   */
  static async hash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Generate a random salt
        const salt = randomBytes(this.SALT_LENGTH);
        
        // Hash the password
        const hash = pbkdf2Sync(
          password,
          salt,
          this.ITERATIONS,
          this.KEY_LENGTH,
          this.DIGEST
        );
        
        // Combine salt and hash
        const combined = salt.toString('hex') + '$' + hash.toString('hex');
        resolve(combined);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Verify a password against a hash
   * @param password - The password to verify
   * @param hashedPassword - The stored hash in format: salt$hash
   * @returns True if the password matches
   */
  static async compare(password: string, hashedPassword: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Split the stored hash into salt and hash
        const [saltHex, hashHex] = hashedPassword.split('$');
        
        if (!saltHex || !hashHex) {
          // Invalid format, might be a bcrypt hash
          resolve(false);
          return;
        }
        
        const salt = Buffer.from(saltHex, 'hex');
        const storedHash = Buffer.from(hashHex, 'hex');
        
        // Hash the provided password with the same salt
        const hash = pbkdf2Sync(
          password,
          salt,
          this.ITERATIONS,
          this.KEY_LENGTH,
          this.DIGEST
        );
        
        // Compare the hashes
        resolve(hash.equals(storedHash));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if a hash is in the old bcrypt format
   * @param hash - The hash to check
   * @returns True if it's a bcrypt hash
   */
  static isBcryptHash(hash: string): boolean {
    return hash.startsWith('$2a$') || hash.startsWith('$2b$');
  }
}