const demoPosts = [
  {
    id: 1,
    username: 'ghost.imvu',
    title: 'Visual dark premium do meu personagem',
    caption: 'Primeiro teste do VUCLIP para comunidade IMVU.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',
    likes: 128,
    comments: 19,
    views: '3,2 mil visualizacoes'
  },
  {
    id: 2,
    username: 'lux.avatar',
    title: 'Clipe novo com edicao neon',
    caption: 'Formato ideal para trends e apresentacao de avatar.',
    mediaType: 'video',
    mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    likes: 264,
    comments: 41,
    views: '8,9 mil visualizacoes'
  }
];

const saved = JSON.parse(localStorage.getItem('vuclip-posts') || 'null');
const posts = saved || demoPosts;

const feed = document.getElementById('feed');
const postModal = document.getElementById('postModal');
const postForm = document.getElementById('postForm');

function getInitials(name) {
  return name.split(/[._\s-]+/).filter(Boolean).slice(0, 2).map(function(part) {
    return (part[0] || '').toUpperCase();
  }).join('');
}

function savePosts() {
  localStorage.setItem('vuclip-posts', JSON.stringify(posts));
}

function renderPost(post) {
  var media = post.mediaType === 'video'
    ? '<video class="card-media" src="' + post.mediaUrl + '" controls playsinline></video>'
    : '<img class="card-media" src="' + post.mediaUrl + '" alt="' + post.title + '" />';

  return '<article class="card">' +
    media +
    '<div class="card-body">' +
      '<div class="card-top">' +
        '<div class="avatar-wrap">' +
          '<div class="avatar">' + getInitials(post.username) + '</div>' +
          '<div>' +
            '<p class="handle">@' + post.username + '</p>' +
            '<h3 class="title">' + post.title + '</h3>' +
          '</div>' +
        '</div>' +
        '<button class="follow-btn">Seguir</button>' +
      '</div>' +
      '<p class="caption">' + post.caption + '</p>' +
      '<div class="meta-row">' +
        '<div class="actions">' +
          '<button class="action-btn" data-action="like" data-id="' + post.id + '">Curtir ' + post.likes + '</button>' +
          '<button class="action-btn">Comentarios ' + post.comments + '</button>' +
          '<button class="action-btn">Compartilhar</button>' +
        '</div>' +
        '<span class="views">' + post.views + '</span>' +
      '</div>' +
    '</div>' +
  '</article>';
}

function renderFeed() {
  feed.innerHTML = posts.slice().reverse().map(renderPost).join('');

  document.querySelectorAll('[data-action="like"]').forEach(function(button) {
    button.addEventListener('click', function() {
      var id = Number(button.dataset.id);
      var post = posts.find(function(item) { return item.id === id; });
      if (!post) return;
      post.likes += 1;
      savePosts();
      renderFeed();
    });
  });
}

function openModal() {
  postModal.classList.remove('hidden');
}

function closeModal() {
  postModal.classList.add('hidden');
}

document.getElementById('openPostModal').addEventListener('click', openModal);
document.getElementById('openPostModalBottom').addEventListener('click', openModal);
document.getElementById('closePostModal').addEventListener('click', closeModal);

postModal.addEventListener('click', function(event) {
  if (event.target === postModal) closeModal();
});

postForm.addEventListener('submit', function(event) {
  event.preventDefault();

  var username = document.getElementById('username').value.trim();
  var title = document.getElementById('title').value.trim();
  var caption = document.getElementById('caption').value.trim();
  var mediaType = document.getElementById('mediaType').value;
  var mediaUrl = document.getElementById('mediaUrl').value.trim();

  posts.push({
    id: Date.now(),
    username: username,
    title: title,
    caption: caption,
    mediaType: mediaType,
    mediaUrl: mediaUrl,
    likes: 0,
    comments: 0,
    views: 'Novo post'
  });

  savePosts();
  renderFeed();
  postForm.reset();
  closeModal();
});

renderFeed();
