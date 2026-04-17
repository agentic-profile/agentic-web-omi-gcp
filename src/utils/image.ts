interface PhotoSize {
    width: number,
    height: number
}

const MIN_THUMB_PHOTO_SIZE: PhotoSize = { width: 60, height: 60 };    // TODO refactor
const MIN_POST_PHOTO_SIZE: PhotoSize = { width: 512, height: 512 };

const wxhRegex = /^\d+x\d+$/

function parseSizeKey( key: string ): PhotoSize | null {
    if( wxhRegex.test( key ) ) {
        const [ width, height ] = key.split( 'x' ).map( Number );
        return { width, height };
    }
    return null;
}

// is a < b?
function isFirstPhotoSmaller( a: PhotoSize, b: PhotoSize ) {
    const minA = Math.min( a.width, a.height ); // TODO is min better than max?
    const minB = Math.min( b.width, b.height );
    return minA < minB;
}

// find smallest size, that is still bigger than or equal to 60x60
export function bestPhotoSize(
    images: Record<string, string> | string[] | undefined,
    minimumSize: PhotoSize
): string | null {
    const record: Record<string, string> =
        images == null
            ? {}
            : Array.isArray( images )
                ? Object.fromEntries( images.map( k => [ k, k ] ) )
                : images;

    const keys = Object.keys( record );
    if( keys.length === 0 )
        return null;    // that was easy!

    let best: (PhotoSize | null) = null;
    let biggest: (PhotoSize | null) = null;
    keys.forEach( key => {
        const candidate = parseSizeKey( key );
        if( !candidate )
            return;

        if( !biggest || isFirstPhotoSmaller( biggest, candidate ) )
            biggest = candidate;

        if( isFirstPhotoSmaller( candidate, minimumSize ) )
            return; // candidate smaller than 60x60

        if( !best )
            best = candidate;
        else if( isFirstPhotoSmaller( candidate, best ) )
            best = candidate;
    });

    if( best != null )
        return photoSize( best );
    else if( biggest != null )
        return photoSize( biggest );
    else
        return null;
}

export function bestThumbPhotoSize( images: string[] ) {
    return bestPhotoSize( images, MIN_THUMB_PHOTO_SIZE );
}

export function bestPostPhotoSize( images: string[] ) {
    return bestPhotoSize( images, MIN_POST_PHOTO_SIZE );
}

export function photoSize( photo: PhotoSize ) {
    return '' + photo.width + 'x' + photo.height;
}

//const AGENTIC_PROFILE_BASE_URL = 'https://iamagentic.ai';
//const ONE_DAY_MILLIS = 1000 * 60 * 60 * 24;

export function userImageUri( profile: any, size: string ) {
    return profile?.media?.images?.[size];
}
