import { definePlane, sense, toSvgPath } from 'color-kit';

const plane = definePlane();

const extract = sense(plane);

const p3Boundary = extract.gamutBoundary();

const boundaryPath = toSvgPath(p3Boundary.points);

export default function PlaneApiPlaygroundDemo() {
  return (
    <div className="demo-container">
      <svg viewBox="0 0 100 100" role="img">
        <path d={boundaryPath} />
      </svg>
    </div>
  );
}
