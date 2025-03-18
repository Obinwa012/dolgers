const handleSanitizedLink = (link) => {
    // Convert the link to a string (in case it's not)
    link = String(link);
  
    // Replace spaces with '%'
    let sanitizedLink = link.replace(/\s/g, '-');
  
    // Remove characters except letters, numbers, '/', '?', '=', '&', '-', '.', '%'
    sanitizedLink = sanitizedLink.replace(/[^a-zA-Z0-9&\-\.\%\?=\/]/g, '').toLowerCase();
  
    return sanitizedLink;
  };

  export default handleSanitizedLink;