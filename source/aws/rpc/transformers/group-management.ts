
export class GroupManagement {
    Name: string;
    Members: Set<string> = new Set();
    Authorizations: Map<string, GroupAuthorization> = new Map();
}

export class GroupAuthorization {
    Services: Map<string, GroupServiceAuthorization> = new Map();
}

export class GroupServiceAuthorization {
    Name: string[];
    AllowAll: boolean;
    AllowMethods: Set<string> = new Set();
}

export class UserManagement {
    Name: string;
    Email: string;
    PhoneNumber: string;
    Groups: Map<string, Set<string>> = new Map();
}