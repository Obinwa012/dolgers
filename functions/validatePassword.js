export function validatePassword (password, matchPassword) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/; 

    if (!password) {
        const failed = 'Password is required.';
        return failed;
    }

    if (!matchPassword) {
        const failed = 'Confirm password is required.';
        return failed;
    }

    if (!passwordRegex.test(password)) {
        const failed = 'Password must be at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.';
        return failed;
    }

    if (password !== matchPassword) {
        const failed = "The passwords you entered don't match. Please try again.";
        return failed;
    }

    return 'true'; 
    
};