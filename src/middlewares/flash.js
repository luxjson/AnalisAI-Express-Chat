function normalizeFlash(value) {
  if (Array.isArray(value)) {
    const messages = value
      .filter(message => message !== undefined && message !== null && String(message).trim() !== '')
      .map(message => String(message));

    return messages.length ? messages.join(' • ') : null;
  }

  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return value;
}

module.exports = (req, res, next) => {
  const originalRender = res.render.bind(res);

  res.render = (view, locals, callback) => {
    const data = locals && typeof locals === 'object' ? { ...locals } : {};
    if (!Object.prototype.hasOwnProperty.call(data, 'success_msg')) {
      data.success_msg = normalizeFlash(req.flash('success_msg'));
    } else {
      data.success_msg = normalizeFlash(data.success_msg);
    }

    if (!Object.prototype.hasOwnProperty.call(data, 'error_msg')) {
      data.error_msg = normalizeFlash(req.flash('error_msg'));
    } else {
      data.error_msg = normalizeFlash(data.error_msg);
    }

    return originalRender(view, data, callback);
  };

  next();
};
