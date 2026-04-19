export function createPageUrl(pageName: string) {
    return '/' + pageName.replaceAll(" ", "-");
}
