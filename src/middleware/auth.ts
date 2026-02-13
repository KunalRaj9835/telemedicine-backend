import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, UserRole } from '../types';
import supabase from '../config/supabase';

interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

// Verify JWT token and attach user to request
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided. Please provide a valid authorization token.'
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Invalid token format'
      });
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Verify user still exists and is active
    const { data: user, error } = await supabase
      .from('ausers')
      .select('id, email, role, is_active')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: 'User not found or token invalid'
      });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: 'Account is deactivated'
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired'
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Role-based access control middleware
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to access this resource'
      });
      return;
    }

    next();
  };
};

// Check if user is the owner of a resource or has admin role
export const authorizeOwnerOrAdmin = (userIdParam: string = 'userId') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];

    if (req.user.role === 'admin' || req.user.id === resourceUserId) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'You can only access your own resources'
    });
  };
};