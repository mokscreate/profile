let _navigateFn = null;

export function setNavigate(fn) {
  _navigateFn = fn;
}

export function navigate(view, params = {}) {
  if (_navigateFn) _navigateFn(view, params);
}
