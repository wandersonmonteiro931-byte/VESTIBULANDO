# Security Documentation - ENEM+ Platform

## Overview
This document outlines the security measures implemented in the ENEM+ educational platform to protect user data and prevent unauthorized access.

## Security Hardening Summary

### 1. User Account Creation & Privilege Escalation Prevention

**Problem Addressed:** Prevent users from self-registering as admin or professor accounts.

**Solution Implemented:**
- Self-registration flow automatically creates "aluno" (student) accounts only
- Firestore rules enforce `tipo: "aluno"` on user document creation from client
- Admin and professor accounts can only be created by existing administrators
- User type field (`tipo`) is protected from unauthorized updates

**Code Location:**
- Frontend: `client/src/pages/Login.tsx` - Registration form and logic
- Backend: `firestore.rules` - User creation validation

### 2. Null Safety Guards

**Problem Addressed:** Prevent runtime errors when user documents are missing or disabled.

**Solution Implemented:**
- Added `userDocExists()` helper function to check document existence
- All `getUserData()` calls now verify document exists before accessing data
- Prevents null reference errors in security rules

**Code Location:**
- `firestore.rules` - All helper functions

### 3. Professor Access Control

**Problem Addressed:** Prevent professors from accessing/grading assignments they don't own.

**Solution Implemented:**
- Added `professorOwnsTarefa()` helper function
- Professors can only read/update entregas (submissions) for their own assignments
- Cross-validated in Firestore rules and file metadata permissions

**Code Location:**
- `firestore.rules` - Entregas collection rules

### 4. File Upload Security

**Problem Addressed:** Prevent malicious file uploads and unauthorized file access.

**Solution Implemented:**
- 8MB file size limit enforced in Firestore rules
- Client-side validation for file type and size
- Proper error handling with user-friendly messages
- Arquivos divididos em blocos de no máximo 400 KB, com SHA-256
- Role/user/class-based access to uploaded files
- Students remain owners of their submissions

**Code Location:**
- `firestore.rules` - `schoolFiles` metadata/chunk restrictions
- `client/src/components/FileUploadZone.tsx` - Client validation

## Security Rules Architecture

### Firestore Database Rules

#### usuarios Collection
```javascript
// Create: Only aluno type allowed from client; admins can create any type
// Read: Users can read their own data; admins can read all
// Update: Protected fields (tipo, ativo) restricted to admins
// Delete: Admins only
```

#### tarefas Collection
```javascript
// Create: Professors and admins only
// Read: All active users can read (educational materials)
// Update/Delete: Only the owning professor or admins
```

#### entregas Collection
```javascript
// Create: Students can submit for themselves only
// Read: Students see their own; professors see submissions for their tarefas; admins see all
// Update: Professors can grade only their own assignment submissions
// Delete: Admins only
```

#### turmas Collection
```javascript
// Create/Update: Admins only
// Read: All authenticated users
// Delete: Admins only
```

### Firestore File Repository

#### `schoolFiles/{fileId}`
```
- Read: owner, explicitly authorized users, class/target students, permitted roles or admin
- Write: authenticated owner only
- Limit: 8MB per file; 400KB raw per chunk
- Integrity: SHA-256 checked before preview/download
```

## User Account Lifecycle

### Self-Registration (Public)
1. User visits registration page
2. Enters name, email, password, turma
3. Account created automatically as "aluno" type
4. User redirected to Student Dashboard

### Admin Account Creation (First Time)
1. Register as a student using self-registration
2. Firebase Admin manually updates document:
   - Navigate to Firestore Console > usuarios collection
   - Find user document by email
   - Edit `tipo` field from "aluno" to "admin"
3. User logs out and back in
4. Now has admin access

### Creating Additional Users (Admin Dashboard)
1. Admin logs in and goes to "Usuários" tab
2. Clicks "Novo Usuário" button
3. Fills in user details and selects type (aluno/professor/admin)
4. New user receives credentials and can log in
5. Note: Client-side account creation only works for "aluno" type due to Firestore rules
6. For professor/admin accounts, use Firebase Console or future backend function

## Security Testing Checklist

- [x] Self-registration creates aluno accounts only
- [x] Cannot escalate privileges by modifying tipo field
- [x] Null guards prevent runtime errors
- [x] Professors cannot access other professors' assignments
- [x] Professors cannot grade other professors' submissions
- [x] Students cannot access other students' files
- [x] File size limits enforced (8MB)
- [x] Inactive users cannot access system
- [x] All rules reviewed by architect agent

## Known Design Decisions

### Tarefa Attachments (Educational Materials)
**Decision:** All authenticated users can read assignment attachment files.

**Rationale:** Assignment materials (PDFs, documents) are educational resources that should be accessible to all students and teachers in the platform. There is no sensitive data in these files.

**Risk Level:** Low - Acceptable for educational platform

### Admin User Creation
**Decision:** Admin dashboard cannot create professor/admin accounts via client.

**Rationale:** Firestore rules prevent client-side creation of non-aluno accounts for security. This is intentional to prevent privilege escalation.

**Workaround:** Use Firebase Console or implement Cloud Function with Admin SDK for privileged account creation.

## Deployment Security Checklist

Before deploying to production:

1. [ ] Deploy latest `firestore.rules` to Firebase Console
2. [ ] Confirm Firebase Storage remains disabled/unconfigured
3. [ ] Enable only necessary Authentication providers
4. [ ] Set up proper Firestore quota alerts and limits
5. [ ] Review all Firestore indexes
6. [ ] Test all user flows (student, teacher, admin)
7. [ ] Verify file upload restrictions and SHA-256 checks
8. [ ] Test inactive user blocking
9. [ ] Monitor Firebase Console for security alerts

## Incident Response

If a security issue is discovered:

1. **Immediate:** Disable affected user accounts via Firebase Console
2. **Short-term:** Deploy hotfix to security rules if needed
3. **Medium-term:** Audit all related data access patterns
4. **Long-term:** Update documentation and add preventive measures

## Future Security Enhancements

1. **Rate Limiting:** Implement Cloud Functions to rate-limit sensitive operations
2. **Audit Logging:** Add comprehensive audit trail for admin actions
3. **Email Verification:** Require email verification before account activation
4. **Two-Factor Authentication:** Add 2FA for admin and professor accounts
5. **File Scanning:** Integrate malware scanning for uploaded files
6. **Session Management:** Implement session timeout and concurrent session limits
7. **Password Policy:** Enforce strong password requirements
8. **IP Whitelisting:** Optional IP restrictions for admin accounts

## Contact & Support

For security concerns or questions:
- Review this documentation first
- Check FIREBASE_SETUP.md for deployment guidance
- Consult Firebase Security Rules documentation
- Contact platform administrator

---

**Last Updated:** October 2025
**Security Review:** Approved by Architect Agent
**Status:** Production Ready
