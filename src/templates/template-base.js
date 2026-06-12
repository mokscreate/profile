export class ResumeTemplate {
  constructor(id, name, description) {
    this.id = id;
    this.name = name;
    this.description = description;
  }

  render(data) {
    throw new Error('must implement render()');
  }

  getStyles() {
    return '';
  }

  formatDate(start, end) {
    if (!start && !end) return '';
    return `${start || '?'} - ${end || '至今'}`;
  }

  getBulletText(bullet) {
    return bullet.useEnhanced && bullet.enhanced ? bullet.enhanced : bullet.original;
  }

  esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
