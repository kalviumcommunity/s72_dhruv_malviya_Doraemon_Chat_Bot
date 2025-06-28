// Remove the insecure TLS bypass
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Only for development!

// Load environment variables with fallback for missing .env file
try {
  require('dotenv').config();
} catch (error) {
  console.log('No .env file found, using default values');
}

// Set default values for environment variables
const config = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/doraemon-chat-bot',
  PORT: process.env.PORT || 10000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
};

// Log configuration (without sensitive data)
console.log('Configuration loaded:', {
  PORT: config.PORT,
  NODE_ENV: config.NODE_ENV,
  CLIENT_URL: config.CLIENT_URL,
  MONGODB_URI: config.MONGODB_URI ? '***configured***' : '***using default***'
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const passport = require('./config/passport');

const app = express();

// CORS for API
const allowedOrigins = [
  'https://s72-dhruv-malviya-doraemon-chat-bot.vercel.app',
  'http://localhost:3000',
  config.CLIENT_URL
].filter(Boolean); // Remove empty values

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize passport
app.use(passport.initialize());

// Root API health check
app.get('/', (req, res) => {
  res.json({
    message: 'Doraemon Chat Bot API',
    status: 'running',
    frontend: config.CLIENT_URL,
    endpoints: {
      auth: '/api/auth/google',
      chat: '/api/chat',
      quiz: '/api/quiz',
      progress: '/api/progress',
      leaderboard: '/api/leaderboard'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// MongoDB connection with updated options
const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      },
      ssl: config.NODE_ENV === 'production',
      tls: config.NODE_ENV === 'production',
      tlsAllowInvalidCertificates: config.NODE_ENV !== 'production',
      retryWrites: true,
      w: 'majority',
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
      heartbeatFrequencyMS: 1000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000
    });
    console.log('Connected to MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('If you are running locally, make sure MongoDB is running or set MONGODB_URI in your .env file');
    // Don't exit in development, allow the app to continue
    if (config.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};
connectDB();

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});
mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Import routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const quizRoutes = require('./routes/quiz');
const progressRoutes = require('./routes/progress');
const leaderboardRoutes = require('./routes/leaderboard');

// Use API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: config.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Create HTTP server and bind Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io logic
io.on('connection', (socket) => {
  console.log('New client connected');
  // Example: join room, send/receive messages
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });
  socket.on('sendMessage', async (data) => {
    try {
      io.to(data.receiverId).emit('receiveMessage', data);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
server.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Client URL: ${config.CLIENT_URL}`);
});

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during app termination:', err);
    process.exit(1);
  }
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
}); 