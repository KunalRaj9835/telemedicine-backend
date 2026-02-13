import bcrypt from 'bcrypt';

/**
 * Utility to generate bcrypt password hashes
 * Usage: ts-node src/utils/hashPassword.ts <password>
 */

const password = process.argv[2];

if (!password) {
  console.log('\n❌ Please provide a password to hash');
  console.log('Usage: ts-node src/utils/hashPassword.ts <password>\n');
  console.log('Example: ts-node src/utils/hashPassword.ts password123\n');
  process.exit(1);
}

async function hashPassword(plainPassword: string) {
  try {
    const hash = await bcrypt.hash(plainPassword, 10);
    console.log('\n✅ Password hashed successfully!\n');
    console.log('Plain password:', plainPassword);
    console.log('Hashed password:', hash);
    console.log('\nYou can use this hash in your SQL update:\n');
    console.log(`UPDATE ausers SET password_hash = '${hash}' WHERE email = 'your_email@example.com';\n`);
  } catch (error) {
    console.error('Error hashing password:', error);
  }
}

hashPassword(password);