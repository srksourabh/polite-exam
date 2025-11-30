# Changelog

All notable changes to the Polite Exam Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-11-30

### 🎉 Production Release - Web App Complete

This is the first production-ready release of the Polite Exam Management System web application with comprehensive exam management, question bank, and result tracking features.

### Added
- **Question Cart System** - Save questions to cart while browsing question bank
  - Add/remove questions to cart with visual counter
  - Cart modal with summary statistics (total, difficulty breakdown, subject grouping)
  - Select All/Deselect All/Clear Cart functionality
  - Direct transfer from cart to exam creation
  - Mobile-responsive cart UI

- **Difficulty Filtering** - Filter questions by difficulty level
  - Easy (Green), Medium (Yellow), Hard (Red) color-coded tags
  - Difficulty selector in question bank
  - Difficulty selector in exam creation
  - Random question selection respects difficulty filters
  - CSV export includes difficulty levels

- **Subject Filtering** - Enhanced filtering capabilities
  - Subject dropdown filter in question bank
  - Subject dropdown filter in exam creation
  - Combined subject + difficulty filtering
  - Maintains filter state during operations

- **Field Validation System** - Prevents Airtable schema errors
  - Validates all fields before sending to Airtable
  - Filters out unknown fields automatically
  - Logs ignored fields for debugging
  - Backward compatible with schema changes

- **Enhanced Rate Limiting** - More user-friendly authentication limits
  - Increased auth rate limit from 5 to 20 requests per 15 minutes
  - Separate rate limits for auth vs general API calls
  - Per-IP tracking for security
  - Better user experience during login/signup

### Fixed
- **Unknown Field Errors** - "Unknown field name: Difficulty" errors resolved
  - Added field validation to POST /api/questions endpoint
  - Added field validation to PUT /api/questions/:id endpoint
  - Questions API now validates all fields before Airtable submission
  - Similar validation applied to Results table operations

- **Authentication Rate Limiting** - "Too many requests" during normal usage
  - Previous 5 requests/15min limit was too restrictive
  - Now allows 20 requests/15min for authentication endpoints
  - Prevents false positives during legitimate usage

### Changed
- **Question Model** - Added Difficulty field support
  - Sample questions updated with difficulty levels
  - Add Question form includes difficulty selector
  - Question bank displays difficulty tags
  - Exam creation respects difficulty selections

### Security
- ✅ Input sanitization for SQL/formula injection prevention
- ✅ Email and mobile number validation
- ✅ Password hashing with SHA-256 + salt
- ✅ CORS configured for Capacitor/mobile apps
- ✅ Environment variable encryption
- ✅ Rate limiting on authentication endpoints

### Performance
- ⚡ Optimized question loading with client-side caching
- ⚡ Reduced API calls with cart system
- ⚡ Efficient filtering with in-memory operations
- ⚡ Vercel CDN deployment for fast global access

### Documentation
- 📚 15+ comprehensive markdown documentation files
- 📚 Production readiness audit report
- 📚 Environment variables reference guide
- 📚 Android deployment guides (in progress)
- 📚 API integration documentation

---

## [1.0.0] - 2025-11-29

### Initial Release Features

#### Core Functionality
- **Admin Dashboard** - Complete exam system management
  - System status monitoring (Airtable, Gemini AI, OCR)
  - Real-time service health checks
  - Color-coded status indicators

- **Question Bank Management**
  - Create, edit, delete questions
  - Unique 5-character IDs (Q0001 format)
  - MCQ format with 4 options
  - Subject categorization (Math, Reasoning, GK)
  - Duplicate detection and removal
  - CSV export functionality

- **Exam Creation System**
  - Manual question selection
  - Random question generation by subject
  - Duration settings (15-180 minutes)
  - Total marks configuration
  - Exam code generation
  - Bulk operations support

- **Student Portal**
  - Secure login system
  - Available exams listing
  - Exam code entry
  - Real-time timer during exams
  - Answer submission tracking
  - Results viewing

- **Examiner Portal**
  - Results verification
  - Score viewing by exam
  - Student performance tracking
  - Exam statistics

- **Results Management**
  - Automatic score calculation
  - Detailed answer sheets
  - Correct/incorrect marking
  - Performance analytics
  - Export capabilities

#### Technical Features
- **Airtable Integration**
  - Personal Access Token authentication
  - Four-table schema (Questions, Exams, Results, Candidates)
  - Real-time data synchronization
  - Field-level validation

- **API Layer**
  - RESTful API design
  - Comprehensive error handling
  - Rate limiting (100 requests/15min general, 20/15min auth)
  - CORS support for mobile apps
  - Security middleware

- **Frontend**
  - Responsive design (mobile, tablet, desktop)
  - Progressive Web App (PWA) support
  - Service Worker for offline functionality
  - Real-time UI updates
  - Modal-based interactions

- **External Services**
  - Gemini AI integration (question generation)
  - OCR Space integration (paper scanning)
  - Email notifications (optional SMTP)

#### Android App (In Progress - 70%)
- ✅ PWA manifest configured
- ✅ Service worker implemented
- ✅ Icons created (192x192, 512x512, maskable)
- ✅ TWA manifest configured
- ✅ Keystore generated
- ⏳ Production build pending
- ⏳ Play Store submission pending

---

## Roadmap

### Version 1.1.0 (Planned)
- [ ] Automated testing suite (unit + integration)
- [ ] Performance monitoring dashboard
- [ ] Advanced analytics and reporting
- [ ] Bulk question import from Excel
- [ ] Question categories and tags
- [ ] Time-based question difficulty adjustment
- [ ] Student progress tracking

### Version 1.2.0 (Planned)
- [ ] Live proctoring integration
- [ ] Video recording during exams
- [ ] AI-powered question generation improvements
- [ ] Multi-language support
- [ ] Advanced permission system
- [ ] Batch operations for bulk management

### Version 2.0.0 (Future)
- [ ] Mobile app completion and Play Store launch
- [ ] iOS app development
- [ ] Real-time collaborative exam creation
- [ ] Gamification features
- [ ] Advanced AI proctoring
- [ ] Integration with LMS platforms

---

## Support and Contact

**Developer:** Sourabh Bhaumik  
**Email:** srksourabh@gmail.com  
**GitHub:** [@srksourabh](https://github.com/srksourabh)  
**Repository:** [polite-exam](https://github.com/srksourabh/polite-exam)  
**Live Demo:** [polite-exam.vercel.app](https://polite-exam.vercel.app)

---

## License

ISC License - See LICENSE file for details

---

## Acknowledgments

- Built with [Airtable](https://airtable.com) for database management
- Deployed on [Vercel](https://vercel.com) for hosting
- AI assistance from [Claude](https://claude.ai) by Anthropic
- Icons from [Favicon.io](https://favicon.io)
- Progressive Web App technology

---

**Last Updated:** November 30, 2025  
**Status:** Production Ready (Web App) | Beta (Android App)
