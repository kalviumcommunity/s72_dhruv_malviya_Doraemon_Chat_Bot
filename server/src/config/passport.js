const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Get configuration with fallbacks
const config = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:10000'
};

// Log OAuth configuration for debugging
console.log('Google OAuth Config:', {
  clientID: config.GOOGLE_CLIENT_ID ? 'Set' : 'Missing',
  clientSecret: config.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing',
  callbackURL: `${config.SERVER_URL}/api/auth/google/callback`
});

// Only set up Google strategy if credentials are provided
if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
  // Set up passport with Google strategy
  passport.use(new GoogleStrategy({
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: `${config.SERVER_URL}/api/auth/google/callback`,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google profile received:', {
          id: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value
        });
        
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id });
        
        // If user exists, return the user
        if (user) {
          console.log('Existing Google user found:', user.username);
          return done(null, user);
        }
        
        // Check if the email is already in use by a non-Google user
        const existingUser = await User.findOne({ email: profile.emails[0].value });
        
        if (existingUser) {
          // Link Google account to existing user
          console.log('Linking Google account to existing user:', existingUser.username);
          existingUser.googleId = profile.id;
          await existingUser.save();
          return done(null, existingUser);
        }
        
        // Create a new user with Google profile data
        console.log('Creating new user from Google profile');
        const newUser = new User({
          googleId: profile.id,
          email: profile.emails[0].value,
          username: profile.displayName.replace(/\s+/g, '') || `user${profile.id.substring(0, 8)}`,
          profile: {
            avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : ''
          }
        });
        
        // Award XP for completing profile with Google login
        newUser.xp = 20; // COMPLETE_PROFILE reward
        
        // Save the new user
        await newUser.save();
        console.log('New Google user created:', newUser.username);
        
        return done(null, newUser);
      } catch (error) {
        console.error('Google authentication error:', error);
        return done(error, null);
      }
    }
  ));
} else {
  console.log('Google OAuth credentials not configured. Google login will be disabled.');
  console.log('To enable Google login, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file');
}

// Serialize user to store in session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport; 