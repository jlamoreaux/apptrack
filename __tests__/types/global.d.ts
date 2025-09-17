declare global {
  var axeConfig: {
    rules?: {
      [key: string]: { enabled: boolean };
    };
  };
  var NextRequest: any;
  var NextResponse: any;
  var Request: any;
  var Response: any;
  var FormData: any;
  var File: any;
}

export {};