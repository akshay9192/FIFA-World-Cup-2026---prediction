import React from 'react';
import { Link } from '../router';

export default function NotFound() {
  return (
    <section className="page-section py-24 text-center">
      <p className="eyebrow">404 · Off the pitch</p>
      <h1 className="page-title mx-auto">That replay route does not exist.</h1>
      <p className="lead mx-auto">Return to the tournament overview and pick up the story from there.</p>
      <Link className="button-primary mt-7" to="/">Back to the replay</Link>
    </section>
  );
}
