import fs from 'fs';
import path from 'path';

export function Mock(mockFn?: (mock: any, ...args: any[]) => any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      if (process.env.NODE_ENV === 'development') {
        const className = target.constructor.name.toLowerCase();
        const mockDataFile = path.join(findMockDataPath(), `${className}/${propertyKey}.json`);
        const mockData = JSON.parse(fs.readFileSync(mockDataFile, 'utf-8'));

        // If mockFn is provided, apply it with the mockData and args, otherwise return mockData directly
        return mockFn ? mockFn.apply(this, [mockData, ...args]) : mockData;
      } else {
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

function findMockDataPath() {
  let mockDataPath = __dirname
  const TARGET_PATH = 'src/mock';

  // Keep going up one directory until we find TARGET_PATH
  while (!fs.existsSync(path.join(mockDataPath, TARGET_PATH))) {
    mockDataPath = path.join(mockDataPath, '..');
  }

  return path.join(mockDataPath, TARGET_PATH);
}