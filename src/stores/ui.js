/** UI store：Toast 提示与推荐阅读弹层 */

import { defineStore } from "pinia";
import { findRead } from "../data/demo";

let toastTimer = null;

export const useUiStore = defineStore("ui", {
  state: () => ({
    toast: "",
    toastVisible: false,
    readId: null,
  }),

  getters: {
    readArticle: (state) => (state.readId ? findRead(state.readId) : null),
    readDialogOpen: (state) => Boolean(state.readId && findRead(state.readId)),
  },

  actions: {
    showToast(message, duration = 2000) {
      this.toast = String(message ?? "");
      this.toastVisible = true;

      if (toastTimer) {
        clearTimeout(toastTimer);
      }
      toastTimer = setTimeout(() => {
        this.toastVisible = false;
        toastTimer = null;
      }, duration);
    },

    hideToast() {
      if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      this.toastVisible = false;
    },

    openRead(id) {
      if (!findRead(id)) {
        return false;
      }
      this.readId = id;
      if (typeof document !== "undefined") {
        document.body.classList.add("is-modal-open");
      }
      return true;
    },

    closeRead() {
      this.readId = null;
      if (typeof document !== "undefined") {
        document.body.classList.remove("is-modal-open");
      }
    },
  },
});
