import { beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteProject, getPublished, listProjects, publishProject, signIn, signUp, updateProject } from "@/lib/store";
import { extractHtml } from "@/lib/ai";

beforeEach(() => localStorage.clear());

describe("file store", () => {
  it("signs up and rejects duplicate email", () => {
    signUp("রহিম", "a@b.com", "1234");
    expect(() => signUp("x", "A@b.com", "1234")).toThrow();
    expect(signIn("a@b.com", "1234").name).toBe("রহিম");
    expect(() => signIn("a@b.com", "bad")).toThrow();
  });
  it("project CRUD and unique slugs", () => {
    const u = signUp("u", "u@u.com", "1234");
    const a = createProject(u.id, "Todo App");
    const b = createProject(u.id, "Todo App");
    expect(a.slug).toBe("todo-app");
    expect(b.slug).toBe("todo-app-2");
    updateProject(a.id, { html: "<html></html>" });
    deleteProject(b.id);
    expect(listProjects(u.id)).toHaveLength(1);
  });
  it("publish requires html and serves under slug", () => {
    const u = signUp("u", "u@u.com", "1234");
    const p = createProject(u.id, "shop");
    expect(() => publishProject(p.id)).toThrow();
    updateProject(p.id, { html: "<div>hi</div>" });
    publishProject(p.id);
    expect(getPublished("shop")?.publishedHtml).toBe("<div>hi</div>");
  });
  it("extracts html from AI reply", () => {
    expect(extractHtml("এই নিন\n```html\n<!DOCTYPE html><html></html>\n```")).toBe("<!DOCTYPE html><html></html>");
    expect(extractHtml("no code")).toBeNull();
  });
});
