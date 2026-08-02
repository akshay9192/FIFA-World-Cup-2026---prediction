import React from 'react';
import { Link } from '../router';

export default function NotFound() {
  return <section className="not-found page-shell"><div className="lost-ball" aria-hidden="true"><span>404</span></div><div><p className="section-index">MATCH NOT FOUND / 404</p><h1>This route left<br /><em>the field.</em></h1><p>The match plan ends here. Return to the Tournament Atlas and pick up the story from the opening whistle.</p><Link className="button-primary" to="/">Return to the atlas</Link></div></section>;
}
