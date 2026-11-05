// Blog cards shared by blogs.html, blog.html (related) and index.html (featured).
// Titles/excerpts come from the API: always textContent, never innerHTML.
const BlogCards = (() => {
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // DOMParser does not run scripts; it turns HTML + entities (&nbsp;) into plain text.
  const plainText = (html) => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.replace(/\s+/g, ' ').trim();

  const formatDate = (blog, month = 'short') => new Date(blog.publishedAt || blog.createdAt)
    .toLocaleDateString('en-IN', { day: 'numeric', month, year: 'numeric' });

  const GRADIENTS = [
    ['#4f46e5', '#7c3aed'], ['#0ea5e9', '#4f46e5'], ['#10b981', '#0ea5e9'],
    ['#f59e0b', '#ef4444'], ['#ec4899', '#8b5cf6'], ['#14b8a6', '#6366f1']
  ];
  const ICONS = [
    [/job|career|recruit|bharti/i, 'fa-briefcase'], [/exam|paper|board|result/i, 'fa-file-alt'],
    [/educat|study|school|class/i, 'fa-graduation-cap'], [/tip|guide|how/i, 'fa-lightbulb'],
    [/news|update/i, 'fa-newspaper']
  ];

  // Same category always gets the same colours and icon.
  function placeholder(category = 'General') {
    const hash = [...category].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const [from, to] = GRADIENTS[hash % GRADIENTS.length];
    const box = el('div', 'bc-placeholder');
    box.style.background = `linear-gradient(135deg, ${from}, ${to})`;
    const icon = el('i', 'fas ' + ((ICONS.find(([re]) => re.test(category)) || [, 'fa-book-open'])[1]));
    icon.setAttribute('aria-hidden', 'true');
    box.appendChild(icon);
    return box;
  }

  function media(blog, eager) {
    const wrap = el('div', 'bc-media');
    if (blog.image) {
      const image = el('img');
      image.src = blog.image;
      image.alt = blog.imageAlt || blog.title || '';
      if (!eager) image.loading = 'lazy';
      image.decoding = 'async';
      wrap.appendChild(image);
    } else wrap.appendChild(placeholder(blog.category));
    return wrap;
  }

  function meta(blog, month) {
    const box = el('div', 'bc-meta');
    const items = [formatDate(blog, month)];
    if (blog.readTime) items.push(blog.readTime + ' min read');
    items.push((blog.views || 0) + ' views');
    items.forEach((text, i) => {
      if (i) box.appendChild(el('span', 'bc-dot', '·')).setAttribute('aria-hidden', 'true');
      box.appendChild(el('span', '', text));
    });
    return box;
  }

  const link = (blog, className) => {
    const a = el('a', className);
    a.href = 'blog.html?slug=' + encodeURIComponent(blog.slug);
    return a;
  };

  function card(blog, { featuredAbove = false, readMore = false } = {}) {
    const a = link(blog, 'bc-card' + (readMore ? ' homepage-blog-card' : ''));
    const body = el('div', 'bc-body');
    const tags = el('div', 'bc-tags');
    if (featuredAbove) tags.append(el('span', 'bc-label', 'Featured above'));
    tags.append(el('span', 'bc-tag', blog.category || 'General'));
    body.append(
      tags,
      el('h3', 'bc-title', blog.title || ''),
      el('p', 'bc-excerpt', plainText(blog.excerpt)),
      meta(blog)
    );
    if (readMore) body.append(el('span', 'bc-more', 'Read more'));
    a.append(media(blog), body);
    return a;
  }

  function featured(blog) {
    const a = link(blog, 'bc-featured');
    const body = el('div', 'bc-body');
    const tags = el('div', 'bc-tags');
    tags.append(el('span', 'bc-label', 'Featured'), el('span', 'bc-tag', blog.category || 'General'));
    const more = el('span', 'bc-more', 'Read article ');
    more.appendChild(el('i', 'fas fa-arrow-right')).setAttribute('aria-hidden', 'true');
    body.append(
      tags,
      el('h2', 'bc-title', blog.title || ''),
      el('p', 'bc-excerpt', plainText(blog.excerpt)),
      meta(blog, 'long'),
      more
    );
    a.append(media(blog, true), body);
    return a;
  }

  // Static markup only, no API data.
  function skeleton(count, className = 'bc-card') {
    return Array.from({ length: count }, () => {
      const box = el('div', className + ' bc-skeleton');
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = '<div class="bc-media"></div><div class="bc-body"><span class="sk sk-tag"></span><span class="sk sk-line"></span><span class="sk sk-line short"></span><span class="sk sk-text"></span></div>';
      return box;
    });
  }

  return { el, plainText, formatDate, card, featured, skeleton };
})();
