import { Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';
import supabase from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { registerSchema, loginSchema } from '../validation/schemas';
import { SignOptions } from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET!;


const JWT_EXPIRES_IN: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '7d';


// Generate JWT token
const generateToken = (userId: string, email: string, role: string): string => {
  return jwt.sign({ id: userId, email, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  const validatedData = registerSchema.parse(req.body);

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('ausers')
    .select('id')
    .eq('email', validatedData.email)
    .single();

  if (existingUser) {
    throw new AppError('User with this email already exists', 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(validatedData.password, 10);

  // Create user
  const { data: user, error: userError } = await supabase
    .from('ausers')
    .insert({
      email: validatedData.email,
      phone: validatedData.phone,
      password_hash: passwordHash,
      role: validatedData.role
    })
    .select()
    .single();

  if (userError || !user) {
  console.error('SUPABASE USER ERROR:', userError);
  throw new AppError(userError?.message || 'Failed to create user', 500);
}

  // Create profile
  const { error: profileError } = await supabase
    .from('aprofiles')
    .insert({
      user_id: user.id,
      first_name: validatedData.firstName,
      last_name: validatedData.lastName,
      date_of_birth: validatedData.dateOfBirth || null,
      gender: validatedData.gender || null
    });

  if (profileError) {
    // Rollback user creation
    await supabase.from('ausers').delete().eq('id', user.id);
    throw new AppError('Failed to create user profile', 500);
  }

  // Generate token
  const token = generateToken(user.id, user.email, user.role);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token
    }
  });
};

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  const validatedData = loginSchema.parse(req.body);

  // Find user
  const { data: user, error } = await supabase
    .from('ausers')
    .select('id, email, password_hash, role, is_active')
    .eq('email', validatedData.email)
    .single();

  if (error || !user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.is_active) {
    throw new AppError('Account is deactivated', 403);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(validatedData.password, user.password_hash);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Update last login
  await supabase
    .from('ausers')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id);

  // Generate token
  const token = generateToken(user.id, user.email, user.role);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token
    }
  });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { data: user, error } = await supabase
    .from('ausers')
    .select(`
      id,
      email,
      phone,
      role,
      is_active,
      email_verified,
      phone_verified,
      created_at,
      aprofiles (
        first_name,
        last_name,
        date_of_birth,
        gender,
        address,
        city,
        state,
        pincode,
        profile_image_url
      )
    `)
    .eq('id', req.user.id)
    .single();

  if (error || !user) {
    throw new AppError('User not found', 404);
  }

  // If user is a doctor, get doctor info
  if (user.role === 'doctor') {
    const { data: doctorInfo } = await supabase
      .from('adoctors')
      .select('*')
      .eq('user_id', user.id)
      .single();

    res.json({
      success: true,
      data: {
        ...user,
        doctorInfo
      }
    });
    return;
  }

  res.json({
    success: true,
    data: user
  });
};
