import { createRouter, createWebHistory } from 'vue-router';

const HomeView = () => import('../views/HomeView.vue');
const CreateSessionView = () => import('../views/CreateSessionView.vue');
const JoinSessionView = () => import('../views/JoinSessionView.vue');
const JoinByCodeView = () => import('../views/JoinByCodeView.vue');
const GameLobbyView = () => import('../views/GameLobbyView.vue');
const NotFoundView = () => import('../views/NotFoundView.vue');

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/create', name: 'create', component: CreateSessionView },
    { path: '/join', name: 'join', component: JoinSessionView },
    { path: '/join/:sessionCode', name: 'join-by-code', component: JoinByCodeView },
    { path: '/game/:sessionCode', name: 'game', component: GameLobbyView },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }
  ]
});
