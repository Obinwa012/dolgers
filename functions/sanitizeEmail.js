export function sanitizeEmail(input){
    if (typeof input !== 'string') {
      return '';
    }else{
      let sanitizedEmail = input.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

      return sanitizedEmail.toString();
    }
  };